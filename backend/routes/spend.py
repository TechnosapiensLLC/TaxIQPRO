"""Chain-wide spend analytics with period-over-period cost-jump alerts."""
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from core.database import db
from core.security import MANAGER_ROLES, get_current_user

router = APIRouter(prefix="/api/org/reports", tags=["organization"])
CurrentUser = Annotated[dict, Depends(get_current_user)]

# A store is flagged when spend rises by both of these at once, so a $4 jump on
# a tiny base never triggers an alert.
JUMP_PCT = 25.0
JUMP_ABS = 50.0


def period_bounds(period: str, offset: int = 0) -> tuple[date, date]:
    """Return the inclusive start/end dates for this or a previous period."""
    today = datetime.utcnow().date()
    if period == "month":
        year, month = today.year, today.month - offset
        while month <= 0:
            month += 12
            year -= 1
        start = date(year, month, 1)
        end = date(year + (month // 12), (month % 12) + 1, 1) - timedelta(days=1)
        return start, end
    start = today - timedelta(days=today.weekday() + 7 * offset)
    return start, start + timedelta(days=6)


def period_label(start: date, end: date, period: str) -> str:
    if period == "month":
        return start.strftime("%B %Y")
    return f"{start.strftime('%b %d')} – {end.strftime('%b %d')}"


def date_only(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    return str(value or "")[:10]


def in_range(value, start: date, end: date) -> bool:
    day = date_only(value)
    return bool(day) and start.isoformat() <= day <= end.isoformat()


def pct_change(current: float, previous: float) -> Optional[float]:
    if previous <= 0:
        return None if current <= 0 else 100.0
    return round((current - previous) / previous * 100, 1)



@router.get("/spend")
async def chain_spend(
    user: CurrentUser,
    period: str = "week",
    store_id: Optional[str] = None,
):
    """Business spend per store for the current period vs the previous one."""
    if period not in ("week", "month"):
        raise HTTPException(400, "period must be 'week' or 'month'")
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(404, "You are not part of a store chain yet")
    if user.get("role") not in MANAGER_ROLES:
        raise HTTPException(403, "Only chain owners, store owners and managers can view this")

    cur_start, cur_end = period_bounds(period, 0)
    prev_start, prev_end = period_bounds(period, 1)

    store_docs = await db.stores.find({"organization_id": org_id}).to_list(length=500)
    store_names = {str(s["_id"]): s["name"] for s in store_docs}
    store_names[""] = "Unassigned"

    scope: dict = {"organization_id": org_id, "is_business": True}
    if user.get("role") == "store_manager":
        scope["store_id"] = user.get("store_id")
    elif store_id:
        scope["store_id"] = store_id

    receipts = await db.receipts.find(scope).to_list(length=20000)
    trips = await db.mileage.find(scope).to_list(length=20000)

    cur = defaultdict(float)
    prev = defaultdict(float)
    cur_cat = defaultdict(lambda: defaultdict(float))
    cur_miles = defaultdict(float)
    prev_miles = defaultdict(float)

    for r in receipts:
        key = r.get("store_id") or ""
        amount = float(r.get("amount") or 0)
        if in_range(r.get("date"), cur_start, cur_end):
            cur[key] += amount
            cur_cat[key][r.get("category") or "Other"] += amount
        elif in_range(r.get("date"), prev_start, prev_end):
            prev[key] += amount

    for t in trips:
        key = t.get("store_id") or ""
        miles = float(t.get("distance_miles") or t.get("distance") or 0)
        if in_range(t.get("date"), cur_start, cur_end):
            cur_miles[key] += miles
        elif in_range(t.get("date"), prev_start, prev_end):
            prev_miles[key] += miles

    keys = set(cur) | set(prev) | set(cur_miles) | set(prev_miles)
    keys |= {str(s["_id"]) for s in store_docs}
    if store_id:
        keys = {store_id}

    stores = []
    for key in sorted(keys, key=lambda k: -cur.get(k, 0)):
        current = round(cur.get(key, 0), 2)
        previous = round(prev.get(key, 0), 2)
        delta = round(current - previous, 2)
        change = pct_change(current, previous)
        flagged = (
            change is not None and change >= JUMP_PCT and delta >= JUMP_ABS
        )
        categories = sorted(
            ({"category": c, "amount": round(v, 2)} for c, v in cur_cat.get(key, {}).items()),
            key=lambda x: -x["amount"],
        )
        stores.append(
            {
                "store_id": key or None,
                "store_name": store_names.get(key, "Unassigned"),
                "current": current,
                "previous": previous,
                "delta": delta,
                "change_pct": change,
                "flagged": flagged,
                "miles": round(cur_miles.get(key, 0), 1),
                "previous_miles": round(prev_miles.get(key, 0), 1),
                "categories": categories,
                "top_category": categories[0]["category"] if categories else None,
            }
        )

    total_current = round(sum(s["current"] for s in stores), 2)
    total_previous = round(sum(s["previous"] for s in stores), 2)

    alerts = []
    for s in stores:
        if not s["flagged"]:
            continue
        driver = s["top_category"] or "spend"
        alerts.append(
            {
                "store_id": s["store_id"],
                "store_name": s["store_name"],
                "delta": s["delta"],
                "change_pct": s["change_pct"],
                "category": driver,
                "message": (
                    f"{s['store_name']} is up ${s['delta']:,.2f} "
                    f"({s['change_pct']:+.0f}%) — mostly {driver}"
                ),
            }
        )

    chain_categories = defaultdict(float)
    for key in cur_cat:
        for cat, amount in cur_cat[key].items():
            chain_categories[cat] += amount

    return {
        "period": period,
        "current_label": period_label(cur_start, cur_end, period),
        "previous_label": period_label(prev_start, prev_end, period),
        "total_current": total_current,
        "total_previous": total_previous,
        "total_delta": round(total_current - total_previous, 2),
        "total_change_pct": pct_change(total_current, total_previous),
        "store_count": len(store_docs),
        "stores": stores,
        "alerts": alerts,
        "categories": sorted(
            ({"category": c, "amount": round(v, 2)} for c, v in chain_categories.items()),
            key=lambda x: -x["amount"],
        ),
        "thresholds": {"percent": JUMP_PCT, "amount": JUMP_ABS},
    }
