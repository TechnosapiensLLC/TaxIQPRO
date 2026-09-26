"""Receipts, mileage, income, dashboard and reference data."""
import os
import io
import json
import base64
import asyncio
import csv
import math
import tempfile
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.shared import *  # noqa: F401,F403
from core.shared import (
    EXPENSE_CATEGORIES,
    IRS_MILEAGE_RATE,
    SELF_EMPLOYMENT_TAX_RATE,
    INCOME_TAX_RATE,
    EMERGENT_LLM_KEY,
    serialize_doc,
)

router = APIRouter()
CurrentUser = Annotated[dict, Depends(get_current_user)]

# Receipt Routes
@router.post("/api/receipts/scan")
async def scan_receipt(user: CurrentUser, image_base64: str = Form(...)):
    """Scan a receipt image and extract data using AI"""
    try:
        # Analyze receipt with AI
        result = await analyze_receipt_with_ai(image_base64)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/receipts")
async def create_receipt(receipt: ReceiptCreate, user: CurrentUser):
    """Create a new receipt entry"""
    category_info = EXPENSE_CATEGORIES.get(receipt.category, {"deductible": False})
    is_business = receipt.is_business if receipt.is_business is not None else category_info.get("deductible", False)

    receipt_doc = {
        "user_id": user["id"],
        "organization_id": user.get("organization_id"),
        "store_id": receipt.store_id or user.get("store_id"),
        "vendor": receipt.vendor,
        "amount": receipt.amount,
        "date": receipt.date,
        "category": receipt.category,
        "notes": receipt.notes or "",
        "image_base64": receipt.image_base64,
        "barcode": receipt.barcode,
        "line_items": receipt.line_items or [],
        "ai_extracted": False,
        "is_business": is_business,
        "is_deductible": is_business and category_info.get("deductible", False),
        "created_at": datetime.utcnow()
    }
    result = await db.receipts.insert_one(receipt_doc)
    receipt_doc["_id"] = result.inserted_id
    return serialize_doc(receipt_doc)

@router.get("/api/receipts")
async def get_receipts(user: CurrentUser, skip: int = 0, limit: int = 50, scope: str = "all"):
    """Get the signed-in user's receipts"""
    query: Dict[str, Any] = {"user_id": user["id"]}
    if scope == "business":
        query["is_business"] = True
    elif scope == "personal":
        query["is_business"] = False
    cursor = db.receipts.find(query).sort("created_at", -1).skip(skip).limit(limit)
    receipts = await cursor.to_list(length=limit)
    return [serialize_doc(r) for r in receipts]

@router.get("/api/receipts/unclassified")
async def get_unclassified_receipts(user: CurrentUser):
    """Get receipts that may need reclassification"""
    cursor = db.receipts.find({
        "user_id": user["id"],
        "$or": [
            {"category": "Other"},
            {"is_deductible": {"$exists": False}},
            {"is_business": {"$exists": False}},
            {"needs_review": True}
        ]
    }).sort("created_at", -1).limit(50)
    
    receipts = await cursor.to_list(length=50)
    return [serialize_doc(r) for r in receipts]

@router.patch("/api/receipts/{receipt_id}/classify")
async def classify_receipt(receipt_id: str, user: CurrentUser, is_deductible: bool = Form(...), category: str = Form(None)):
    """Classify a receipt as business (deductible) or personal"""
    receipt = await db.receipts.find_one({"_id": ObjectId(receipt_id), "user_id": user["id"]})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    update_data = {
        "is_deductible": is_deductible,
        "is_business": is_deductible,
        "needs_review": False
    }
    
    if category:
        update_data["category"] = category
    
    await db.receipts.update_one(
        {"_id": ObjectId(receipt_id)},
        {"$set": update_data}
    )
    
    return {"message": f"Receipt classified as {'deductible' if is_deductible else 'personal'}"}

@router.get("/api/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, user: CurrentUser):
    """Get a specific receipt"""
    receipt = await db.receipts.find_one({"_id": ObjectId(receipt_id), "user_id": user["id"]})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return serialize_doc(receipt)

@router.delete("/api/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str, user: CurrentUser):
    """Delete a receipt"""
    result = await db.receipts.delete_one({"_id": ObjectId(receipt_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"message": "Receipt deleted successfully"}

# Mileage Routes
@router.post("/api/mileage")
async def create_mileage(mileage: MileageCreate, user: CurrentUser):
    """Create a new mileage entry"""
    is_business = mileage.purpose == "Business"
    deduction = mileage.distance * IRS_MILEAGE_RATE if is_business else 0

    mileage_doc = {
        "user_id": user["id"],
        "organization_id": user.get("organization_id"),
        "store_id": mileage.store_id or user.get("store_id"),
        "start_location": mileage.start_location,
        "end_location": mileage.end_location,
        "distance": mileage.distance,
        "distance_miles": mileage.distance,
        "purpose": mileage.purpose,
        "date": mileage.date,
        "notes": mileage.notes or "",
        "is_business": is_business,
        "deduction_amount": deduction,
        "created_at": datetime.utcnow()
    }
    result = await db.mileage.insert_one(mileage_doc)
    mileage_doc["_id"] = result.inserted_id
    return serialize_doc(mileage_doc)

@router.get("/api/mileage")
async def get_mileage(user: CurrentUser, skip: int = 0, limit: int = 50):
    """Get the signed-in user's mileage entries"""
    cursor = db.mileage.find({"user_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit)
    entries = await cursor.to_list(length=limit)
    return [serialize_doc(m) for m in entries]

@router.delete("/api/mileage/{mileage_id}")
async def delete_mileage(mileage_id: str, user: CurrentUser):
    """Delete a mileage entry"""
    result = await db.mileage.delete_one({"_id": ObjectId(mileage_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mileage entry not found")
    return {"message": "Mileage entry deleted successfully"}

# Income Routes
@router.post("/api/income")
async def create_income(income: IncomeCreate, user: CurrentUser):
    """Create a new income entry"""
    income_doc = {
        "user_id": user["id"],
        "organization_id": user.get("organization_id"),
        "store_id": user.get("store_id"),
        "source": income.source,
        "amount": income.amount,
        "date": income.date,
        "description": income.description or "",
        "is_1099": income.is_1099,
        "is_business": True,
        "created_at": datetime.utcnow()
    }
    result = await db.income.insert_one(income_doc)
    income_doc["_id"] = result.inserted_id
    return serialize_doc(income_doc)

@router.get("/api/income")
async def get_income(user: CurrentUser, skip: int = 0, limit: int = 50):
    """Get the signed-in user's income entries"""
    cursor = db.income.find({"user_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit)
    entries = await cursor.to_list(length=limit)
    return [serialize_doc(i) for i in entries]

@router.delete("/api/income/{income_id}")
async def delete_income(income_id: str, user: CurrentUser):
    """Delete an income entry"""
    result = await db.income.delete_one({"_id": ObjectId(income_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income entry not found")
    return {"message": "Income entry deleted successfully"}

# Dashboard Route
@router.get("/api/dashboard")
async def get_dashboard(user: CurrentUser):
    """Get dashboard summary with tax estimates"""
    scope = {"user_id": user["id"]}
    receipts = await db.receipts.find(scope).to_list(length=5000)
    mileage_entries = await db.mileage.find(scope).to_list(length=5000)
    income_entries = await db.income.find(scope).to_list(length=5000)
    
    # Calculate totals
    total_income = sum(i.get("amount", 0) for i in income_entries)
    total_expenses = sum(r.get("amount", 0) for r in receipts if r.get("is_deductible", False))
    total_mileage_deduction = sum(m.get("deduction_amount", 0) for m in mileage_entries)
    
    # Calculate expense categories breakdown
    expense_categories = {}
    for receipt in receipts:
        cat = receipt.get("category", "Other")
        expense_categories[cat] = expense_categories.get(cat, 0) + receipt.get("amount", 0)
    
    # Calculate monthly income for chart
    monthly_income = {}
    for entry in income_entries:
        try:
            date = datetime.strptime(entry.get("date", ""), "%Y-%m-%d")
            month_key = date.strftime("%Y-%m")
            monthly_income[month_key] = monthly_income.get(month_key, 0) + entry.get("amount", 0)
        except:
            pass
    
    # Convert to list format for charts
    monthly_income_list = [
        {"month": k, "amount": v} 
        for k, v in sorted(monthly_income.items())
    ][-6:]  # Last 6 months
    
    # Calculate net income and estimated taxes
    total_deductions = total_expenses + total_mileage_deduction
    net_income = max(0, total_income - total_deductions)
    
    # Self-employment tax (15.3% of 92.35% of net income)
    se_tax_base = net_income * 0.9235
    self_employment_tax = se_tax_base * SELF_EMPLOYMENT_TAX_RATE
    
    # Income tax (simplified estimate)
    income_tax = net_income * INCOME_TAX_RATE
    
    estimated_tax = self_employment_tax + income_tax
    quarterly_payment = estimated_tax / 4
    
    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "total_mileage_deduction": round(total_mileage_deduction, 2),
        "net_income": round(net_income, 2),
        "estimated_tax": round(estimated_tax, 2),
        "quarterly_payment": round(quarterly_payment, 2),
        "receipts_count": len(receipts),
        "trips_count": len(mileage_entries),
        "income_entries_count": len(income_entries),
        "expense_categories": expense_categories,
        "monthly_income": monthly_income_list
    }

# Tax Coach Route
@router.post("/api/tax-coach")
async def tax_coach(message: TaxCoachMessage, user: CurrentUser):
    """AI Tax Coach - answers tax questions"""
    # Get user's financial data for context
    dashboard_data = await get_dashboard(user)
    
    user_data = {
        "total_income": dashboard_data["total_income"],
        "total_expenses": dashboard_data["total_expenses"],
        "mileage_deduction": dashboard_data["total_mileage_deduction"],
        "estimated_tax": dashboard_data["estimated_tax"],
        "categories": dashboard_data["expense_categories"]
    }
    
    response = await get_tax_coach_response(
        message.message,
        message.context or "",
        user_data
    )
    return response

# Categories Route
@router.get("/api/categories")
async def get_categories():
    """Get all expense categories"""
    return EXPENSE_CATEGORIES

# Gig Platforms Route
@router.get("/api/gig-platforms")
async def get_gig_platforms():
    """Get supported gig platforms"""
    return [
        {"id": "uber", "name": "Uber", "icon": "car"},
        {"id": "lyft", "name": "Lyft", "icon": "car"},
        {"id": "doordash", "name": "DoorDash", "icon": "fast-food"},
        {"id": "ubereats", "name": "Uber Eats", "icon": "restaurant"},
        {"id": "instacart", "name": "Instacart", "icon": "cart"},
        {"id": "grubhub", "name": "Grubhub", "icon": "fast-food"},
        {"id": "amazon_flex", "name": "Amazon Flex", "icon": "cube"},
        {"id": "upwork", "name": "Upwork", "icon": "briefcase"},
        {"id": "fiverr", "name": "Fiverr", "icon": "briefcase"},
        {"id": "taskrabbit", "name": "TaskRabbit", "icon": "construct"},
        {"id": "rover", "name": "Rover", "icon": "paw"},
        {"id": "airbnb", "name": "Airbnb", "icon": "home"},
        {"id": "turo", "name": "Turo", "icon": "car-sport"},
        {"id": "etsy", "name": "Etsy", "icon": "storefront"},
        {"id": "other", "name": "Other", "icon": "ellipsis-horizontal"}
    ]


# ===============================================
# PREMIUM FEATURE 4: Swipe to Classify (Backend)
# ===============================================
