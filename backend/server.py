"""
Receipt Brain - AI Expense & Tax Assistant for Gig Workers
Backend API Server
"""
import os
import json
import base64
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

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

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "receipt_brain")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# AI Integration
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

# Pydantic models
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema, handler=None):
        return {"type": "string"}

# Request/Response Models
class UserCreate(BaseModel):
    email: str
    name: str
    gig_types: List[str] = []

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    gig_types: List[str]
    created_at: datetime

class ReceiptCreate(BaseModel):
    vendor: str
    amount: float
    date: str
    category: str
    notes: Optional[str] = ""
    image_base64: Optional[str] = None

class ReceiptResponse(BaseModel):
    id: str
    vendor: str
    amount: float
    date: str
    category: str
    notes: str
    image_base64: Optional[str]
    ai_extracted: bool
    is_deductible: bool
    created_at: datetime

class ReceiptScanResponse(BaseModel):
    vendor: str
    amount: float
    date: str
    category: str
    suggested_deduction: str
    confidence: float
    raw_text: str

class MileageCreate(BaseModel):
    start_location: str
    end_location: str
    distance: float
    purpose: str  # Business, Personal, Commute
    date: str
    notes: Optional[str] = ""

class MileageResponse(BaseModel):
    id: str
    start_location: str
    end_location: str
    distance: float
    purpose: str
    date: str
    notes: str
    deduction_amount: float
    created_at: datetime

class IncomeCreate(BaseModel):
    source: str  # Uber, Lyft, DoorDash, Upwork, etc.
    amount: float
    date: str
    description: Optional[str] = ""
    is_1099: bool = True

class IncomeResponse(BaseModel):
    id: str
    source: str
    amount: float
    date: str
    description: str
    is_1099: bool
    created_at: datetime

class DashboardResponse(BaseModel):
    total_income: float
    total_expenses: float
    total_mileage_deduction: float
    net_income: float
    estimated_tax: float
    quarterly_payment: float
    receipts_count: int
    trips_count: int
    income_entries_count: int
    expense_categories: dict
    monthly_income: List[dict]

class TaxCoachMessage(BaseModel):
    message: str
    context: Optional[str] = ""

class TaxCoachResponse(BaseModel):
    response: str
    suggestions: List[str]
    relevant_deductions: List[str]

# Helper functions
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

# IRS 2025 Standard Mileage Rate (estimated)
IRS_MILEAGE_RATE = 0.70  # $0.70 per mile for business use

# Self-employment tax rate
SELF_EMPLOYMENT_TAX_RATE = 0.153  # 15.3%
INCOME_TAX_RATE = 0.22  # Estimated average for gig workers

# Expense categories and their deductibility
EXPENSE_CATEGORIES = {
    "Vehicle & Gas": {"deductible": True, "category_type": "business"},
    "Equipment & Supplies": {"deductible": True, "category_type": "business"},
    "Phone & Internet": {"deductible": True, "category_type": "business"},
    "Insurance": {"deductible": True, "category_type": "business"},
    "Food & Meals": {"deductible": False, "category_type": "personal"},
    "Office Supplies": {"deductible": True, "category_type": "business"},
    "Software & Subscriptions": {"deductible": True, "category_type": "business"},
    "Professional Services": {"deductible": True, "category_type": "business"},
    "Education & Training": {"deductible": True, "category_type": "business"},
    "Marketing & Advertising": {"deductible": True, "category_type": "business"},
    "Health & Medical": {"deductible": False, "category_type": "personal"},
    "Entertainment": {"deductible": False, "category_type": "personal"},
    "Parking & Tolls": {"deductible": True, "category_type": "business"},
    "Maintenance & Repairs": {"deductible": True, "category_type": "business"},
    "Other": {"deductible": False, "category_type": "unknown"}
}

async def analyze_receipt_with_ai(image_base64: str) -> dict:
    """Use AI to extract receipt data from image"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        if not EMERGENT_LLM_KEY:
            # Return mock data if no API key
            return {
                "vendor": "Unknown Vendor",
                "amount": 0.0,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "category": "Other",
                "suggested_deduction": "Unable to determine - please review manually",
                "confidence": 0.0,
                "raw_text": "AI analysis unavailable - API key not configured"
            }
        
        # Initialize chat with Claude for vision
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"receipt-scan-{datetime.now().timestamp()}",
            system_message="""You are an expert receipt analyzer for gig workers. 
            Extract the following from receipts:
            - Vendor/Store name
            - Total amount
            - Date of purchase
            - Category (choose from: Vehicle & Gas, Equipment & Supplies, Phone & Internet, Insurance, Food & Meals, Office Supplies, Software & Subscriptions, Professional Services, Education & Training, Marketing & Advertising, Health & Medical, Entertainment, Parking & Tolls, Maintenance & Repairs, Other)
            - Whether this is likely a deductible business expense for a gig worker
            
            Respond ONLY in valid JSON format with these exact keys:
            {"vendor": "string", "amount": number, "date": "YYYY-MM-DD", "category": "string", "suggested_deduction": "string explanation", "confidence": number 0-1, "raw_text": "extracted text from receipt"}"""
        ).with_model("anthropic", "claude-sonnet-4-20250514")
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        # Send message with image
        user_message = UserMessage(
            text="Analyze this receipt and extract the vendor, amount, date, category, and determine if it's a deductible business expense for a gig worker. Return ONLY valid JSON.",
            image_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            # Clean response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
            return result
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract data manually
            return {
                "vendor": "Unknown",
                "amount": 0.0,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "category": "Other",
                "suggested_deduction": response[:200] if response else "Could not analyze",
                "confidence": 0.3,
                "raw_text": response[:500] if response else ""
            }
            
    except Exception as e:
        print(f"AI analysis error: {str(e)}")
        return {
            "vendor": "Unknown",
            "amount": 0.0,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "category": "Other",
            "suggested_deduction": f"Error analyzing receipt: {str(e)}",
            "confidence": 0.0,
            "raw_text": ""
        }

async def get_tax_coach_response(message: str, context: str, user_data: dict) -> dict:
    """AI Tax Coach - answers tax questions for gig workers"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        if not EMERGENT_LLM_KEY:
            return {
                "response": "AI Tax Coach is currently unavailable. Please configure the API key.",
                "suggestions": ["Track all business expenses", "Keep mileage logs", "Save receipts"],
                "relevant_deductions": []
            }
        
        # Build context from user data
        user_context = f"""
        User Financial Summary:
        - Total Income: ${user_data.get('total_income', 0):,.2f}
        - Total Expenses: ${user_data.get('total_expenses', 0):,.2f}
        - Mileage Deduction: ${user_data.get('mileage_deduction', 0):,.2f}
        - Estimated Tax: ${user_data.get('estimated_tax', 0):,.2f}
        - Expense Categories: {user_data.get('categories', {})}
        """
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tax-coach-{datetime.now().timestamp()}",
            system_message=f"""You are an expert AI Tax Coach for gig economy workers (Uber, Lyft, DoorDash, Upwork, etc.).
            
            Your role is to:
            1. Answer tax questions in simple, plain English
            2. Help identify potential deductions
            3. Explain self-employment tax obligations
            4. Provide actionable advice for tax savings
            
            Current User Context:
            {user_context}
            
            Additional Context: {context}
            
            Always be helpful, accurate, and remind users you're an AI assistant, not a licensed tax professional.
            For complex situations, recommend consulting a CPA.
            
            Respond in JSON format:
            {{"response": "your helpful answer", "suggestions": ["actionable tip 1", "tip 2"], "relevant_deductions": ["deduction 1", "deduction 2"]}}"""
        ).with_model("anthropic", "claude-sonnet-4-20250514")
        
        user_message = UserMessage(text=message)
        response = await chat.send_message(user_message)
        
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
            return result
        except json.JSONDecodeError:
            return {
                "response": response,
                "suggestions": [],
                "relevant_deductions": []
            }
            
    except Exception as e:
        print(f"Tax coach error: {str(e)}")
        return {
            "response": f"I apologize, but I encountered an error: {str(e)}. Please try again.",
            "suggestions": [],
            "relevant_deductions": []
        }

# API Routes

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Receipt Brain API", "version": "1.0.0"}

# User Routes
@app.post("/api/users", response_model=dict)
async def create_user(user: UserCreate):
    """Create a new user"""
    # Check if user already exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        return serialize_doc(existing)
    
    user_doc = {
        "email": user.email,
        "name": user.name,
        "gig_types": user.gig_types,
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return serialize_doc(user_doc)

@app.get("/api/users/{email}")
async def get_user(email: str):
    """Get user by email"""
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_doc(user)

# Receipt Routes
@app.post("/api/receipts/scan")
async def scan_receipt(image_base64: str = Form(...)):
    """Scan a receipt image and extract data using AI"""
    try:
        # Analyze receipt with AI
        result = await analyze_receipt_with_ai(image_base64)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/receipts")
async def create_receipt(receipt: ReceiptCreate):
    """Create a new receipt entry"""
    category_info = EXPENSE_CATEGORIES.get(receipt.category, {"deductible": False})
    
    receipt_doc = {
        "vendor": receipt.vendor,
        "amount": receipt.amount,
        "date": receipt.date,
        "category": receipt.category,
        "notes": receipt.notes or "",
        "image_base64": receipt.image_base64,
        "ai_extracted": False,
        "is_deductible": category_info.get("deductible", False),
        "created_at": datetime.utcnow()
    }
    result = await db.receipts.insert_one(receipt_doc)
    receipt_doc["_id"] = result.inserted_id
    return serialize_doc(receipt_doc)

@app.get("/api/receipts")
async def get_receipts(skip: int = 0, limit: int = 50):
    """Get all receipts"""
    cursor = db.receipts.find().sort("created_at", -1).skip(skip).limit(limit)
    receipts = await cursor.to_list(length=limit)
    return [serialize_doc(r) for r in receipts]

@app.get("/api/receipts/{receipt_id}")
async def get_receipt(receipt_id: str):
    """Get a specific receipt"""
    receipt = await db.receipts.find_one({"_id": ObjectId(receipt_id)})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return serialize_doc(receipt)

@app.delete("/api/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str):
    """Delete a receipt"""
    result = await db.receipts.delete_one({"_id": ObjectId(receipt_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"message": "Receipt deleted successfully"}

# Mileage Routes
@app.post("/api/mileage")
async def create_mileage(mileage: MileageCreate):
    """Create a new mileage entry"""
    # Calculate deduction only for business trips
    deduction = mileage.distance * IRS_MILEAGE_RATE if mileage.purpose == "Business" else 0
    
    mileage_doc = {
        "start_location": mileage.start_location,
        "end_location": mileage.end_location,
        "distance": mileage.distance,
        "purpose": mileage.purpose,
        "date": mileage.date,
        "notes": mileage.notes or "",
        "deduction_amount": deduction,
        "created_at": datetime.utcnow()
    }
    result = await db.mileage.insert_one(mileage_doc)
    mileage_doc["_id"] = result.inserted_id
    return serialize_doc(mileage_doc)

@app.get("/api/mileage")
async def get_mileage(skip: int = 0, limit: int = 50):
    """Get all mileage entries"""
    cursor = db.mileage.find().sort("created_at", -1).skip(skip).limit(limit)
    entries = await cursor.to_list(length=limit)
    return [serialize_doc(m) for m in entries]

@app.delete("/api/mileage/{mileage_id}")
async def delete_mileage(mileage_id: str):
    """Delete a mileage entry"""
    result = await db.mileage.delete_one({"_id": ObjectId(mileage_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mileage entry not found")
    return {"message": "Mileage entry deleted successfully"}

# Income Routes
@app.post("/api/income")
async def create_income(income: IncomeCreate):
    """Create a new income entry"""
    income_doc = {
        "source": income.source,
        "amount": income.amount,
        "date": income.date,
        "description": income.description or "",
        "is_1099": income.is_1099,
        "created_at": datetime.utcnow()
    }
    result = await db.income.insert_one(income_doc)
    income_doc["_id"] = result.inserted_id
    return serialize_doc(income_doc)

@app.get("/api/income")
async def get_income(skip: int = 0, limit: int = 50):
    """Get all income entries"""
    cursor = db.income.find().sort("created_at", -1).skip(skip).limit(limit)
    entries = await cursor.to_list(length=limit)
    return [serialize_doc(i) for i in entries]

@app.delete("/api/income/{income_id}")
async def delete_income(income_id: str):
    """Delete an income entry"""
    result = await db.income.delete_one({"_id": ObjectId(income_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income entry not found")
    return {"message": "Income entry deleted successfully"}

# Dashboard Route
@app.get("/api/dashboard")
async def get_dashboard():
    """Get dashboard summary with tax estimates"""
    # Get all data
    receipts = await db.receipts.find().to_list(length=1000)
    mileage_entries = await db.mileage.find().to_list(length=1000)
    income_entries = await db.income.find().to_list(length=1000)
    
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
@app.post("/api/tax-coach")
async def tax_coach(message: TaxCoachMessage):
    """AI Tax Coach - answers tax questions"""
    # Get user's financial data for context
    dashboard_data = await get_dashboard()
    
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
@app.get("/api/categories")
async def get_categories():
    """Get all expense categories"""
    return EXPENSE_CATEGORIES

# Gig Platforms Route
@app.get("/api/gig-platforms")
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
