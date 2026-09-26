"""Distance calculation helper."""
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
# DISTANCE CALCULATION HELPER
# ===============================================
import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the distance between two points on Earth using Haversine formula"""
    R = 3959  # Earth's radius in miles
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

class DistanceRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float

class DistanceResponse(BaseModel):
    distance_miles: float
    estimated_deduction: float

@router.post("/api/calculate-distance", response_model=DistanceResponse)
async def calculate_distance(request: DistanceRequest):
    """Calculate distance between two coordinates and estimated deduction"""
    distance = haversine_distance(
        request.start_lat, request.start_lng,
        request.end_lat, request.end_lng
    )
    
    # Apply a road factor (roads are typically 1.3x longer than straight line)
    road_distance = distance * 1.3
    
    return {
        "distance_miles": round(road_distance, 2),
        "estimated_deduction": round(road_distance * IRS_MILEAGE_RATE, 2)
    }

