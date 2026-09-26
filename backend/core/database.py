"""Shared database handle so routers and server.py use one client."""
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "receipt_brain")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
