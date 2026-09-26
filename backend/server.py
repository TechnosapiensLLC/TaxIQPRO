"""
Receipt Brain - AI Expense & Tax Assistant for Gig Workers
Backend API Server
"""
import os
import io
import json
import base64
import asyncio
import csv
import tempfile
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Annotated
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from core.database import client, db
from core.security import ensure_indexes, get_current_user
from routes import auth as auth_routes
from routes import org as org_routes
from routes import exports as export_routes
from routes import qbo as qbo_routes

load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Receipt Brain API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection (shared handle from core.database)
CurrentUser = Annotated[dict, Depends(get_current_user)]

app.include_router(auth_routes.router)
app.include_router(org_routes.router)
app.include_router(export_routes.router)
app.include_router(qbo_routes.router)


from routes import records as record_routes
from routes import geo as geo_routes
from routes import imports as import_routes
from routes import trips as trip_routes
from routes import reminders as reminder_routes
from routes import gas as gas_routes
from routes import taxtools as taxtool_routes
from routes import route_planner as route_planner_routes
from routes import shopping as shopping_routes
from routes import spend as spend_routes

app.include_router(record_routes.router)
app.include_router(geo_routes.router)
app.include_router(import_routes.router)
app.include_router(trip_routes.router)
app.include_router(reminder_routes.router)
app.include_router(gas_routes.router)
app.include_router(taxtool_routes.router)
app.include_router(route_planner_routes.router)
app.include_router(shopping_routes.router)
app.include_router(spend_routes.router)


@app.on_event("startup")
async def _startup():
    await ensure_indexes()


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "TaxIQ Pro API", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
