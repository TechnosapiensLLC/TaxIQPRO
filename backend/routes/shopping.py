"""Warehouse shopping runs: scan items, then check out as one expense."""
from datetime import datetime
from typing import Annotated, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/shopping-runs", tags=["shopping"])
CurrentUser = Annotated[dict, Depends(get_current_user)]

OPEN_STATUSES = ("open",)


class RunCreate(BaseModel):
    vendor: str = Field(min_length=1, max_length=160)
    store_id: Optional[str] = None
    category: str = "Inventory & Stock"


class ItemAdd(BaseModel):
    barcode: Optional[str] = None
    name: str = Field(min_length=1, max_length=200)
    qty: float = Field(default=1, gt=0)
    unit_price: float = Field(default=0, ge=0)


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    qty: Optional[float] = Field(default=None, gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)


class Checkout(BaseModel):
    receipt_total: Optional[float] = Field(default=None, ge=0)
    receipt_image_base64: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = ""
    is_business: bool = True


def line_total(item: dict) -> float:
    return round(float(item.get("qty", 1)) * float(item.get("unit_price", 0)), 2)


def serialize_run(run: dict) -> dict:
    items = run.get("items", [])
    scanned_total = round(sum(line_total(i) for i in items), 2)
    return {
        "id": str(run["_id"]),
        "vendor": run["vendor"],
        "store_id": run.get("store_id"),
        "category": run.get("category", "Inventory & Stock"),
        "status": run.get("status", "open"),
        "items": [dict(i, line_total=line_total(i)) for i in items],
        "item_count": len(items),
        "unit_count": round(sum(float(i.get("qty", 1)) for i in items), 2),
        "scanned_total": scanned_total,
        "receipt_total": run.get("receipt_total"),
        "variance": (
            round(float(run["receipt_total"]) - scanned_total, 2)
            if run.get("receipt_total") is not None
            else None
        ),
        "receipt_id": str(run["receipt_id"]) if run.get("receipt_id") else None,
        "started_at": run["created_at"].isoformat() if run.get("created_at") else None,
    }



@router.post("")
async def start_run(body: RunCreate, user: CurrentUser):
    """Start a warehouse run. Only one run may be open at a time per user."""
    open_run = await db.shopping_runs.find_one({"user_id": user["id"], "status": "open"})
    if open_run:
        raise HTTPException(409, "You already have an open shopping run")
    doc = {
        "user_id": user["id"],
        "organization_id": user.get("organization_id"),
        "store_id": body.store_id or user.get("store_id"),
        "vendor": body.vendor,
        "category": body.category,
        "status": "open",
        "items": [],
        "created_at": datetime.utcnow(),
    }
    result = await db.shopping_runs.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_run(doc)


@router.get("")
async def list_runs(user: CurrentUser, status: Optional[str] = None):
    query: dict = {"user_id": user["id"]}
    if status:
        query["status"] = status
    runs = await db.shopping_runs.find(query).sort("created_at", -1).to_list(length=100)
    return [serialize_run(r) for r in runs]


@router.get("/active")
async def active_run(user: CurrentUser):
    run = await db.shopping_runs.find_one({"user_id": user["id"], "status": "open"})
    return serialize_run(run) if run else None


@router.get("/lookup/{barcode}")
async def lookup_barcode(barcode: str, user: CurrentUser):
    """Remember items by barcode so the second scan pre-fills name and price."""
    run = await db.shopping_runs.find_one(
        {"user_id": user["id"], "items.barcode": barcode},
        sort=[("created_at", -1)],
    )
    if run:
        for item in reversed(run.get("items", [])):
            if item.get("barcode") == barcode:
                return {
                    "found": True,
                    "barcode": barcode,
                    "name": item.get("name"),
                    "unit_price": item.get("unit_price", 0),
                }
    return {"found": False, "barcode": barcode, "name": None, "unit_price": 0}


@router.get("/{run_id}")
async def get_run(run_id: str, user: CurrentUser):
    run = await db.shopping_runs.find_one({"_id": ObjectId(run_id), "user_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    return serialize_run(run)


async def _open_run_or_404(run_id: str, user: dict) -> dict:
    run = await db.shopping_runs.find_one({"_id": ObjectId(run_id), "user_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    if run.get("status") != "open":
        raise HTTPException(409, "This run is already checked out")
    return run


@router.post("/{run_id}/items")
async def add_item(run_id: str, body: ItemAdd, user: CurrentUser):
    run = await _open_run_or_404(run_id, user)
    items = run.get("items", [])
    item = body.model_dump()
    item["scanned_at"] = datetime.utcnow().isoformat()

    # Same barcode scanned again bumps the quantity instead of adding a row.
    if item.get("barcode"):
        for existing in items:
            if existing.get("barcode") == item["barcode"]:
                existing["qty"] = float(existing.get("qty", 1)) + item["qty"]
                if item["unit_price"]:
                    existing["unit_price"] = item["unit_price"]
                await db.shopping_runs.update_one({"_id": run["_id"]}, {"$set": {"items": items}})
                run["items"] = items
                return serialize_run(run)

    items.append(item)
    await db.shopping_runs.update_one({"_id": run["_id"]}, {"$set": {"items": items}})
    run["items"] = items
    return serialize_run(run)


@router.patch("/{run_id}/items/{index}")
async def update_item(run_id: str, index: int, body: ItemUpdate, user: CurrentUser):
    run = await _open_run_or_404(run_id, user)
    items = run.get("items", [])
    if index < 0 or index >= len(items):
        raise HTTPException(400, "Invalid item")
    for key, value in body.model_dump(exclude_none=True).items():
        items[index][key] = value
    await db.shopping_runs.update_one({"_id": run["_id"]}, {"$set": {"items": items}})
    run["items"] = items
    return serialize_run(run)


@router.delete("/{run_id}/items/{index}")
async def remove_item(run_id: str, index: int, user: CurrentUser):
    run = await _open_run_or_404(run_id, user)
    items = run.get("items", [])
    if index < 0 or index >= len(items):
        raise HTTPException(400, "Invalid item")
    items.pop(index)
    await db.shopping_runs.update_one({"_id": run["_id"]}, {"$set": {"items": items}})
    run["items"] = items
    return serialize_run(run)


@router.post("/{run_id}/checkout")
async def checkout_run(run_id: str, body: Checkout, user: CurrentUser):
    """Close the run and write ONE expense holding every scanned line item."""
    run = await _open_run_or_404(run_id, user)
    items = run.get("items", [])
    if not items:
        raise HTTPException(400, "Scan at least one item before checking out")

    scanned_total = round(sum(line_total(i) for i in items), 2)
    receipt_total = body.receipt_total
    ai_read = None

    # A receipt photo wins over the scanned sum — it is the number the IRS sees.
    if body.receipt_image_base64 and receipt_total is None:
        from core.shared import analyze_receipt_with_ai

        ai_read = await analyze_receipt_with_ai(body.receipt_image_base64)
        if ai_read and float(ai_read.get("amount") or 0) > 0:
            receipt_total = round(float(ai_read["amount"]), 2)

    final_total = receipt_total if receipt_total else scanned_total
    category = body.category or run.get("category", "Inventory & Stock")
    vendor = (ai_read or {}).get("vendor") or run["vendor"]

    receipt_doc = {
        "user_id": user["id"],
        "organization_id": run.get("organization_id"),
        "store_id": run.get("store_id"),
        "vendor": vendor,
        "amount": final_total,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "category": category,
        "notes": (body.notes or f"Warehouse run — {len(items)} items scanned").strip(),
        "image_base64": body.receipt_image_base64,
        "line_items": [dict(i, line_total=line_total(i)) for i in items],
        "ai_extracted": bool(ai_read),
        "is_business": body.is_business,
        "is_deductible": body.is_business,
        "shopping_run_id": run["_id"],
        "created_at": datetime.utcnow(),
    }
    inserted = await db.receipts.insert_one(receipt_doc)

    await db.shopping_runs.update_one(
        {"_id": run["_id"]},
        {
            "$set": {
                "status": "checked_out",
                "receipt_total": final_total,
                "receipt_id": inserted.inserted_id,
                "checked_out_at": datetime.utcnow(),
            }
        },
    )
    run.update({"status": "checked_out", "receipt_total": final_total, "receipt_id": inserted.inserted_id})

    payload = serialize_run(run)
    payload["scanned_total"] = scanned_total
    payload["ai_read_total"] = ai_read.get("amount") if ai_read else None
    return payload


@router.delete("/{run_id}")
async def delete_run(run_id: str, user: CurrentUser):
    run = await db.shopping_runs.find_one({"_id": ObjectId(run_id), "user_id": user["id"]})
    if not run:
        raise HTTPException(404, "Run not found")
    if run.get("receipt_id"):
        raise HTTPException(409, "Checked-out runs cannot be deleted — delete the expense instead")
    await db.shopping_runs.delete_one({"_id": run["_id"]})
    return {"deleted": True}

