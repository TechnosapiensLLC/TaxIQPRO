"""Weekly route planning that auto-logs deductible business mileage."""
from datetime import datetime, timedelta
from typing import Annotated, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from core.security import MANAGER_ROLES, get_current_user
from core.shared import IRS_MILEAGE_RATE
from routes.geo import haversine_distance

router = APIRouter(prefix="/api/routes", tags=["routes"])
CurrentUser = Annotated[dict, Depends(get_current_user)]


class Stop(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    address: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    stops: List[Stop] = Field(min_length=2)
    store_id: Optional[str] = None
    round_trip: bool = True


class ScheduleCreate(BaseModel):
    dates: List[str] = Field(min_length=1)
    assignee_id: Optional[str] = None


class Arrival(BaseModel):
    stop_index: int
    lat: Optional[float] = None
    lng: Optional[float] = None


def planned_miles(stops: List[dict], round_trip: bool) -> float:
    """Straight-line distance between consecutive geocoded stops."""
    total = 0.0
    points = [s for s in stops if s.get("lat") is not None and s.get("lng") is not None]
    for a, b in zip(points, points[1:]):
        total += haversine_distance(a["lat"], a["lng"], b["lat"], b["lng"])
    if round_trip and len(points) > 1:
        total += haversine_distance(
            points[-1]["lat"], points[-1]["lng"], points[0]["lat"], points[0]["lng"]
        )
    return round(total, 2)


def actual_miles(stops: List[dict], round_trip: bool) -> float:
    """Distance across the stops the driver actually confirmed arriving at."""
    visited = [
        s
        for s in stops
        if s.get("arrived_at") and s.get("actual_lat") is not None and s.get("actual_lng") is not None
    ]
    total = 0.0
    for a, b in zip(visited, visited[1:]):
        total += haversine_distance(a["actual_lat"], a["actual_lng"], b["actual_lat"], b["actual_lng"])
    if round_trip and len(visited) > 1:
        total += haversine_distance(
            visited[-1]["actual_lat"], visited[-1]["actual_lng"], visited[0]["actual_lat"], visited[0]["actual_lng"]
        )
    return round(total, 2)


def serialize_plan(plan: dict) -> dict:
    return {
        "id": str(plan["_id"]),
        "name": plan["name"],
        "stops": plan["stops"],
        "store_id": plan.get("store_id"),
        "round_trip": plan.get("round_trip", True),
        "planned_miles": plan.get("planned_miles", 0),
        "estimated_deduction": round(plan.get("planned_miles", 0) * IRS_MILEAGE_RATE, 2),
    }


def serialize_run(run: dict) -> dict:
    stops = run.get("stops", [])
    return {
        "id": str(run["_id"]),
        "plan_id": str(run["plan_id"]),
        "plan_name": run.get("plan_name", ""),
        "date": run["date"],
        "status": run.get("status", "planned"),
        "store_id": run.get("store_id"),
        "assignee_id": run.get("assignee_id"),
        "round_trip": run.get("round_trip", True),
        "planned_miles": run.get("planned_miles", 0),
        "actual_miles": run.get("actual_miles"),
        "total_miles": run.get("actual_miles") or run.get("planned_miles", 0),
        "deduction_amount": run.get("deduction_amount"),
        "mileage_id": str(run["mileage_id"]) if run.get("mileage_id") else None,
        "stops_total": len(stops),
        "stops_done": sum(1 for s in stops if s.get("arrived_at")),
        "stops": stops,
    }


# ---------------------------------------------------------------- route plans


@router.post("")
async def create_plan(body: PlanCreate, user: CurrentUser):
    stops = [s.model_dump() for s in body.stops]
    doc = {
        "user_id": user["id"],
        "organization_id": user.get("organization_id"),
        "store_id": body.store_id or user.get("store_id"),
        "name": body.name,
        "stops": stops,
        "round_trip": body.round_trip,
        "planned_miles": planned_miles(stops, body.round_trip),
        "created_at": datetime.utcnow(),
    }
    result = await db.route_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_plan(doc)


@router.get("")
async def list_plans(user: CurrentUser):
    query = {"user_id": user["id"]}
    if user.get("role") in MANAGER_ROLES and user.get("organization_id"):
        query = {"organization_id": user["organization_id"]}
    plans = await db.route_plans.find(query).sort("created_at", -1).to_list(length=200)
    return [serialize_plan(p) for p in plans]


@router.delete("/{plan_id}")
async def delete_plan(plan_id: str, user: CurrentUser):
    result = await db.route_plans.delete_one({"_id": ObjectId(plan_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Route not found")
    await db.route_runs.delete_many({"plan_id": ObjectId(plan_id), "status": "planned"})
    return {"deleted": True}


# ----------------------------------------------------------------- scheduling


@router.post("/{plan_id}/schedule")
async def schedule_plan(plan_id: str, body: ScheduleCreate, user: CurrentUser):
    plan = await db.route_plans.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(404, "Route not found")
    if plan["user_id"] != user["id"] and plan.get("organization_id") != user.get("organization_id"):
        raise HTTPException(403, "Not your route")

    assignee = body.assignee_id or user["id"]
    created = []
    for day in body.dates:
        existing = await db.route_runs.find_one(
            {"plan_id": plan["_id"], "date": day, "assignee_id": assignee}
        )
        if existing:
            continue
        run = {
            "user_id": assignee,
            "created_by": user["id"],
            "organization_id": plan.get("organization_id"),
            "store_id": plan.get("store_id"),
            "plan_id": plan["_id"],
            "plan_name": plan["name"],
            "assignee_id": assignee,
            "date": day,
            "status": "planned",
            "round_trip": plan.get("round_trip", True),
            "planned_miles": plan.get("planned_miles", 0),
            "stops": [dict(s, arrived_at=None) for s in plan["stops"]],
            "created_at": datetime.utcnow(),
        }
        result = await db.route_runs.insert_one(run)
        run["_id"] = result.inserted_id
        created.append(serialize_run(run))
    return {"scheduled": len(created), "runs": created}


@router.get("/runs")
async def list_runs(user: CurrentUser, week_start: Optional[str] = None):
    """Seven days of runs starting at ``week_start`` (defaults to this Monday)."""
    if week_start:
        start = datetime.strptime(week_start, "%Y-%m-%d").date()
    else:
        today = datetime.utcnow().date()
        start = today - timedelta(days=today.weekday())
    days = [(start + timedelta(days=i)).isoformat() for i in range(7)]

    runs = await db.route_runs.find(
        {"assignee_id": user["id"], "date": {"$in": days}}
    ).sort("date", 1).to_list(length=200)

    by_day = {d: [] for d in days}
    for run in runs:
        by_day[run["date"]].append(serialize_run(run))

    return {
        "week_start": start.isoformat(),
        "days": [{"date": d, "runs": by_day[d]} for d in days],
        "planned_miles": round(
            sum(r.get("planned_miles", 0) for r in runs if r.get("status") != "completed"), 2
        ),
        "logged_miles": round(
            sum(r.get("actual_miles") or 0 for r in runs if r.get("status") == "completed"), 2
        ),
        "logged_deduction": round(
            sum(r.get("deduction_amount") or 0 for r in runs if r.get("status") == "completed"), 2
        ),
    }



# --------------------------------------------------------------- driving a run


@router.post("/runs/{run_id}/start")
async def start_run(run_id: str, user: CurrentUser):
    run = await db.route_runs.find_one({"_id": ObjectId(run_id), "assignee_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    if run.get("status") == "completed":
        raise HTTPException(409, "Run already completed")
    await db.route_runs.update_one(
        {"_id": run["_id"]},
        {"$set": {"status": "in_progress", "started_at": datetime.utcnow()}},
    )
    run["status"] = "in_progress"
    return serialize_run(run)


@router.post("/runs/{run_id}/arrive")
async def arrive_at_stop(run_id: str, body: Arrival, user: CurrentUser):
    run = await db.route_runs.find_one({"_id": ObjectId(run_id), "assignee_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    stops = run.get("stops", [])
    if body.stop_index < 0 or body.stop_index >= len(stops):
        raise HTTPException(400, "Invalid stop")

    stop = stops[body.stop_index]
    stop["arrived_at"] = datetime.utcnow().isoformat()
    # Fall back to the planned coordinates when GPS is unavailable.
    stop["actual_lat"] = body.lat if body.lat is not None else stop.get("lat")
    stop["actual_lng"] = body.lng if body.lng is not None else stop.get("lng")
    stops[body.stop_index] = stop

    updates = {"stops": stops, "status": "in_progress"}
    if not run.get("started_at"):
        updates["started_at"] = datetime.utcnow()
    await db.route_runs.update_one({"_id": run["_id"]}, {"$set": updates})
    run.update(updates)
    return serialize_run(run)


@router.post("/runs/{run_id}/complete")
async def complete_run(run_id: str, user: CurrentUser):
    """Close the run and write a single deductible business mileage record."""
    run = await db.route_runs.find_one({"_id": ObjectId(run_id), "assignee_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    if run.get("mileage_id"):
        raise HTTPException(409, "Run already logged")

    stops = run.get("stops", [])
    round_trip = run.get("round_trip", True)
    miles = actual_miles(stops, round_trip) or run.get("planned_miles", 0)
    deduction = round(miles * IRS_MILEAGE_RATE, 2)
    visited = [s for s in stops if s.get("arrived_at")]
    first = visited[0]["name"] if visited else (stops[0]["name"] if stops else "Route start")
    last = visited[-1]["name"] if visited else (stops[-1]["name"] if stops else "Route end")

    mileage_doc = {
        "user_id": user["id"],
        "organization_id": run.get("organization_id"),
        "store_id": run.get("store_id"),
        "start_location": first,
        "end_location": last if not round_trip else first,
        "distance": miles,
        "distance_miles": miles,
        "purpose": "Business",
        "date": run["date"],
        "notes": f"Route: {run.get('plan_name', 'Scheduled route')} ({len(visited)}/{len(stops)} stops)",
        "is_business": True,
        "deduction_amount": deduction,
        "route_run_id": run["_id"],
        "created_at": datetime.utcnow(),
    }
    inserted = await db.mileage.insert_one(mileage_doc)

    await db.route_runs.update_one(
        {"_id": run["_id"]},
        {
            "$set": {
                "status": "completed",
                "actual_miles": miles,
                "deduction_amount": deduction,
                "mileage_id": inserted.inserted_id,
                "completed_at": datetime.utcnow(),
            }
        },
    )
    run.update(
        {
            "status": "completed",
            "actual_miles": miles,
            "deduction_amount": deduction,
            "mileage_id": inserted.inserted_id,
        }
    )
    return serialize_run(run)


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str, user: CurrentUser):
    run = await db.route_runs.find_one({"_id": ObjectId(run_id), "assignee_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    if run.get("mileage_id"):
        raise HTTPException(409, "Completed runs cannot be deleted — delete the mileage entry instead")
    await db.route_runs.delete_one({"_id": run["_id"]})
    return {"deleted": True}

