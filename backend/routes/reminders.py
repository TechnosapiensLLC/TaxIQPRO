"""Tax reminders, notifications and IRS due dates."""
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

# ===============================================
# PREMIUM FEATURE 5: Tax Reminders & Notifications
# ===============================================

@router.get("/api/reminders")
async def get_reminders(user: CurrentUser):
    """Get all tax reminders"""
    cursor = db.reminders.find({"user_id": user["id"]}).sort("due_date", 1)
    reminders = await cursor.to_list(length=100)
    return [serialize_doc(r) for r in reminders]

@router.post("/api/reminders")
async def create_reminder(reminder: ReminderCreate, user: CurrentUser):
    """Create a new tax reminder"""
    reminder_doc = {
        "user_id": user["id"],
        "type": reminder.type,
        "title": reminder.title,
        "description": reminder.description or "",
        "due_date": reminder.due_date,
        "repeat": reminder.repeat,
        "enabled": reminder.enabled,
        "created_at": datetime.utcnow()
    }
    result = await db.reminders.insert_one(reminder_doc)
    reminder_doc["_id"] = result.inserted_id
    
    return serialize_doc(reminder_doc)

@router.patch("/api/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, user: CurrentUser, enabled: bool = Form(None), due_date: str = Form(None)):
    """Update a reminder"""
    reminder = await db.reminders.find_one({"_id": ObjectId(reminder_id), "user_id": user["id"]})
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    update_data = {}
    if enabled is not None:
        update_data["enabled"] = enabled
    if due_date:
        update_data["due_date"] = due_date
    
    if update_data:
        await db.reminders.update_one(
            {"_id": ObjectId(reminder_id)},
            {"$set": update_data}
        )
    
    updated = await db.reminders.find_one({"_id": ObjectId(reminder_id)})
    return serialize_doc(updated)

@router.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: CurrentUser):
    """Delete a reminder"""
    result = await db.reminders.delete_one({"_id": ObjectId(reminder_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

@router.get("/api/tax-dates")
async def get_tax_dates():
    """Get upcoming important tax dates"""
    # IRS quarterly estimated tax payment dates for 2025-2026
    current_year = datetime.now().year
    
    tax_dates = [
        {
            "id": "q1",
            "title": "Q1 Estimated Tax Due",
            "date": f"{current_year}-04-15",
            "description": "First quarter estimated tax payment"
        },
        {
            "id": "q2",
            "title": "Q2 Estimated Tax Due",
            "date": f"{current_year}-06-15",
            "description": "Second quarter estimated tax payment"
        },
        {
            "id": "q3",
            "title": "Q3 Estimated Tax Due",
            "date": f"{current_year}-09-15",
            "description": "Third quarter estimated tax payment"
        },
        {
            "id": "q4",
            "title": "Q4 Estimated Tax Due",
            "date": f"{current_year + 1}-01-15",
            "description": "Fourth quarter estimated tax payment"
        },
        {
            "id": "filing",
            "title": "Tax Filing Deadline",
            "date": f"{current_year + 1}-04-15",
            "description": "Federal income tax filing deadline"
        }
    ]
    
    # Filter to only future dates
    today = datetime.now().strftime("%Y-%m-%d")
    upcoming = [d for d in tax_dates if d["date"] >= today]
    
    # Calculate days until each date
    for date in upcoming:
        due = datetime.strptime(date["date"], "%Y-%m-%d")
        days_left = (due - datetime.now()).days
        date["days_left"] = max(0, days_left)
    
    return upcoming

@router.post("/api/reminders/setup-defaults")
async def setup_default_reminders(user: CurrentUser):
    """Set up default tax reminders"""
    # Get tax dates
    tax_dates = await get_tax_dates()
    
    created = 0
    for td in tax_dates:
        # Check if reminder already exists
        existing = await db.reminders.find_one({"type": td["id"], "user_id": user["id"]})
        if not existing:
            reminder_doc = {
                "user_id": user["id"],
                "type": td["id"],
                "title": td["title"],
                "description": td["description"],
                "due_date": td["date"],
                "repeat": None,
                "enabled": True,
                "created_at": datetime.utcnow()
            }
            await db.reminders.insert_one(reminder_doc)
            created += 1
    
    return {"message": f"Created {created} default reminders"}

