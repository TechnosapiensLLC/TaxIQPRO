"""Auto trip detection settings and classification."""
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
# PREMIUM FEATURE 3: Auto Trip Detection Settings
# ===============================================

@router.get("/api/trips/settings")
async def get_trip_settings(user: CurrentUser):
    """Get auto trip detection settings"""
    settings = await db.trip_settings.find_one({"user_id": user["id"]})
    if settings:
        return serialize_doc(settings)
    
    # Return defaults
    return {
        "auto_detect_enabled": False,
        "default_trip_type": "ask",
        "sensitivity_level": "medium"
    }

@router.post("/api/trips/settings")
async def save_trip_settings(settings: TripSettings, user: CurrentUser):
    """Save auto trip detection settings"""
    settings_doc = {
        "user_id": user["id"],
        "auto_detect_enabled": settings.auto_detect_enabled,
        "default_trip_type": settings.default_trip_type,
        "sensitivity_level": settings.sensitivity_level,
        "updated_at": datetime.utcnow()
    }
    await db.trip_settings.update_one(
        {"user_id": user["id"]}, {"$set": settings_doc}, upsert=True
    )
    return serialize_doc(settings_doc)

@router.post("/api/trips/auto")
async def create_auto_trip(trip: TripCreate, user: CurrentUser):
    """Record an automatically detected trip"""
    is_business = trip.purpose == "Business"
    deduction = trip.distance * IRS_MILEAGE_RATE if is_business and trip.distance else 0
    
    trip_doc = {
        "user_id": user["id"],
        "organization_id": user.get("organization_id"),
        "store_id": trip.store_id or user.get("store_id"),
        "start_location": trip.start_location,
        "end_location": trip.end_location or "",
        "start_lat": trip.start_lat,
        "start_lng": trip.start_lng,
        "end_lat": trip.end_lat,
        "end_lng": trip.end_lng,
        "distance": trip.distance or 0,
        "distance_miles": trip.distance or 0,
        "purpose": trip.purpose,
        "date": trip.date,
        "is_auto_detected": trip.is_auto_detected,
        "is_business": is_business,
        "deduction_amount": deduction,
        "notes": "Auto-detected trip" if trip.is_auto_detected else "",
        "created_at": datetime.utcnow()
    }
    result = await db.mileage.insert_one(trip_doc)
    trip_doc["_id"] = result.inserted_id
    
    return serialize_doc(trip_doc)

@router.get("/api/trips/pending")
async def get_pending_trips(user: CurrentUser):
    """Get trips that need classification"""
    cursor = db.mileage.find({
        "user_id": user["id"],
        "is_auto_detected": True,
        "purpose": {"$in": ["ask", "pending"]}
    }).sort("created_at", -1).limit(50)
    
    trips = await cursor.to_list(length=50)
    return [serialize_doc(t) for t in trips]

@router.patch("/api/trips/{trip_id}/classify")
async def classify_trip(trip_id: str, user: CurrentUser, purpose: str = Form(...)):
    """Classify an auto-detected trip as business or personal"""
    trip = await db.mileage.find_one({"_id": ObjectId(trip_id), "user_id": user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    is_business = purpose == "Business"
    deduction = trip.get("distance", 0) * IRS_MILEAGE_RATE if is_business else 0
    
    await db.mileage.update_one(
        {"_id": ObjectId(trip_id)},
        {"$set": {"purpose": purpose, "is_business": is_business, "deduction_amount": deduction}}
    )
    
    return {"message": f"Trip classified as {purpose}", "deduction_amount": deduction}

