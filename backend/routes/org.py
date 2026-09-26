"""Store-chain organization routes: chains, stores, members, invites, reports."""
import secrets
from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from core.security import (
    MANAGER_ROLES,
    create_service_token,
    get_current_user,
    public_user,
)

router = APIRouter(prefix="/api/org", tags=["organization"])

ASSIGNABLE_ROLES = ("store_owner", "store_manager", "driver_employee")


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    address: Optional[str] = ""
    store_number: Optional[str] = ""


class InviteCreate(BaseModel):
    role: str
    store_id: Optional[str] = None
    email: Optional[str] = None


class MemberUpdate(BaseModel):
    role: Optional[str] = None
    store_id: Optional[str] = None
    disabled: Optional[bool] = None


class ServiceTokenCreate(BaseModel):
    service_name: str = Field(min_length=1, max_length=80)
    scopes: list[str] = ["receipts:read", "mileage:read", "reports:read"]


def _require_org(user: dict) -> str:
    org = user.get("organization_id")
    if not org:
        raise HTTPException(400, "You are not part of a store chain yet")
    return org


def _require_manager(user: dict) -> str:
    if user.get("role") not in MANAGER_ROLES:
        raise HTTPException(403, "Only owners and managers can do this")
    return _require_org(user)


@router.post("", status_code=201)
async def create_organization(
    body: OrgCreate, user: Annotated[dict, Depends(get_current_user)]
):
    if user.get("organization_id"):
        raise HTTPException(409, "You already belong to a store chain")
    org = {
        "name": body.name.strip(),
        "type": "store_chain",
        "owner_user_id": user["id"],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.organizations.insert_one(org)
    org_id = str(result.inserted_id)
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"organization_id": org_id, "role": "chain_owner"}},
    )
    return {"id": org_id, "name": org["name"], "role": "chain_owner"}


@router.get("/me")
async def my_organization(user: Annotated[dict, Depends(get_current_user)]):
    org_id = user.get("organization_id")
    if not org_id:
        return {"organization": None, "role": user.get("role"), "store": None}
    org = await db.organizations.find_one({"_id": ObjectId(org_id)})
    store = None
    if user.get("store_id"):
        s = await db.stores.find_one({"_id": ObjectId(user["store_id"])})
        if s:
            store = {"id": str(s["_id"]), "name": s["name"]}
    return {
        "organization": {"id": org_id, "name": org["name"]} if org else None,
        "role": user.get("role"),
        "store": store,
    }


@router.post("/stores", status_code=201)
async def create_store(
    body: StoreCreate, user: Annotated[dict, Depends(get_current_user)]
):
    if user.get("role") not in ("chain_owner", "store_owner"):
        raise HTTPException(403, "Only chain or store owners can add stores")
    org_id = _require_org(user)
    doc = {
        "organization_id": org_id,
        "name": body.name.strip(),
        "address": body.address or "",
        "store_number": body.store_number or "",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.stores.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "organization_id": org_id,
        "name": doc["name"],
        "address": doc["address"],
        "store_number": doc["store_number"],
    }


@router.get("/stores")
async def list_stores(user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(user)
    query: dict = {"organization_id": org_id}
    if user.get("role") in ("store_manager", "driver_employee") and user.get("store_id"):
        query["_id"] = ObjectId(user["store_id"])
    stores = await db.stores.find(query).to_list(length=200)
    return [
        {
            "id": str(s["_id"]),
            "name": s["name"],
            "address": s.get("address", ""),
            "store_number": s.get("store_number", ""),
        }
        for s in stores
    ]


@router.post("/invites", status_code=201)
async def create_invite(
    body: InviteCreate, user: Annotated[dict, Depends(get_current_user)]
):
    org_id = _require_manager(user)
    if body.role not in ASSIGNABLE_ROLES:
        raise HTTPException(400, f"Role must be one of {ASSIGNABLE_ROLES}")
    if user["role"] == "store_manager":
        if body.role != "driver_employee":
            raise HTTPException(403, "Managers can only invite driver/employees")
        store_id = user.get("store_id")
    else:
        store_id = body.store_id
    code = secrets.token_hex(4).upper()
    await db.invites.insert_one(
        {
            "code": code,
            "organization_id": org_id,
            "store_id": store_id,
            "role": body.role,
            "email": (body.email or "").strip().lower() or None,
            "used": False,
            "created_by": user["id"],
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"code": code, "role": body.role, "store_id": store_id}


@router.get("/invites")
async def list_invites(user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_manager(user)
    invites = await db.invites.find({"organization_id": org_id}).to_list(length=200)
    return [
        {
            "code": i["code"],
            "role": i["role"],
            "store_id": i.get("store_id"),
            "email": i.get("email"),
            "used": i.get("used", False),
        }
        for i in invites
    ]


@router.get("/members")
async def list_members(user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_manager(user)
    query: dict = {"organization_id": org_id}
    if user["role"] == "store_manager":
        query["store_id"] = user.get("store_id")
    members = await db.users.find(query).to_list(length=500)
    return [public_user(m) for m in members]


@router.patch("/members/{member_id}")
async def update_member(
    member_id: str, body: MemberUpdate, user: Annotated[dict, Depends(get_current_user)]
):
    if user.get("role") not in ("chain_owner", "store_owner"):
        raise HTTPException(403, "Only owners can change member roles")
    org_id = _require_org(user)
    member = await db.users.find_one(
        {"_id": ObjectId(member_id), "organization_id": org_id}
    )
    if not member:
        raise HTTPException(404, "Member not found")
    updates = body.model_dump(exclude_none=True)
    if "role" in updates and updates["role"] not in ASSIGNABLE_ROLES:
        raise HTTPException(400, f"Role must be one of {ASSIGNABLE_ROLES}")
    if updates:
        await db.users.update_one({"_id": ObjectId(member_id)}, {"$set": updates})
    fresh = await db.users.find_one({"_id": ObjectId(member_id)})
    return public_user(fresh)


@router.get("/reports/summary")
async def org_summary(
    user: Annotated[dict, Depends(get_current_user)],
    store_id: Optional[str] = None,
    year: Optional[int] = None,
):
    """Consolidated *business-only* miles and expenses.

    Personal records are excluded entirely so employee privacy is preserved.
    """
    org_id = _require_manager(user)
    flt: dict = {"organization_id": org_id, "is_business": True}
    if user["role"] == "store_manager":
        flt["store_id"] = user.get("store_id")
    elif store_id:
        flt["store_id"] = store_id
    if year:
        flt["date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31T23:59:59"}

    receipts = await db.receipts.find(flt).to_list(length=5000)
    trips = await db.mileage.find(flt).to_list(length=5000)

    members = await db.users.find({"organization_id": org_id}).to_list(length=500)
    names = {str(m["_id"]): m.get("name") or m.get("email") for m in members}
    stores = await db.stores.find({"organization_id": org_id}).to_list(length=200)
    store_names = {str(s["_id"]): s["name"] for s in stores}

    per_employee: dict = {}
    for r in receipts:
        key = r.get("user_id", "unknown")
        e = per_employee.setdefault(
            key,
            {
                "user_id": key,
                "name": names.get(key, "Unknown"),
                "expenses": 0.0,
                "miles": 0.0,
                "mileage_deduction": 0.0,
                "receipt_count": 0,
                "trip_count": 0,
            },
        )
        e["expenses"] += float(r.get("amount", 0) or 0)
        e["receipt_count"] += 1
    for t in trips:
        key = t.get("user_id", "unknown")
        e = per_employee.setdefault(
            key,
            {
                "user_id": key,
                "name": names.get(key, "Unknown"),
                "expenses": 0.0,
                "miles": 0.0,
                "mileage_deduction": 0.0,
                "receipt_count": 0,
                "trip_count": 0,
            },
        )
        e["miles"] += float(t.get("distance_miles") or t.get("distance") or 0)
        e["mileage_deduction"] += float(t.get("deduction_amount", 0) or 0)
        e["trip_count"] += 1

    per_store: dict = {}
    for coll, amount_key in ((receipts, "amount"), (trips, "deduction_amount")):
        for row in coll:
            sid = row.get("store_id") or "unassigned"
            s = per_store.setdefault(
                sid,
                {
                    "store_id": sid,
                    "name": store_names.get(sid, "Unassigned"),
                    "expenses": 0.0,
                    "mileage_deduction": 0.0,
                    "miles": 0.0,
                },
            )
            if amount_key == "amount":
                s["expenses"] += float(row.get("amount", 0) or 0)
            else:
                s["mileage_deduction"] += float(row.get("deduction_amount", 0) or 0)
                s["miles"] += float(row.get("distance_miles") or row.get("distance") or 0)

    total_expenses = sum(float(r.get("amount", 0) or 0) for r in receipts)
    total_miles = sum(float(t.get("distance_miles") or t.get("distance") or 0) for t in trips)
    total_mileage_deduction = sum(
        float(t.get("deduction_amount", 0) or 0) for t in trips
    )

    def rounded(rows):
        out = []
        for row in rows:
            out.append({k: (round(v, 2) if isinstance(v, float) else v) for k, v in row.items()})
        return out

    return {
        "organization_id": org_id,
        "scope": "business_only",
        "totals": {
            "expenses": round(total_expenses, 2),
            "miles": round(total_miles, 1),
            "mileage_deduction": round(total_mileage_deduction, 2),
            "receipt_count": len(receipts),
            "trip_count": len(trips),
            "employee_count": len(per_employee),
        },
        "per_employee": rounded(per_employee.values()),
        "per_store": rounded(per_store.values()),
        "privacy_note": "Personal (non-business) receipts and trips are never included in chain reports.",
    }


@router.post("/service-token", status_code=201)
async def issue_service_token(
    body: ServiceTokenCreate, user: Annotated[dict, Depends(get_current_user)]
):
    """One-time server-to-server token for the external C-Store BOS backend."""
    if user.get("role") != "chain_owner":
        raise HTTPException(403, "Only the chain owner can issue service tokens")
    org_id = _require_org(user)
    token = await create_service_token(body.service_name, org_id, body.scopes)
    return {
        "token": token,
        "scopes": body.scopes,
        "warning": "Shown once. Store it in your BOS server secret manager, never in a client app.",
    }
