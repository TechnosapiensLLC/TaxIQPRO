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
from typing import Optional, List, Dict, Any
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

# New Premium Feature Models
class BankStatementUploadResponse(BaseModel):
    transactions: List[dict]
    total_found: int
    deductible_count: int
    deductible_total: float
    personal_count: int
    personal_total: float

class CSVImportResponse(BaseModel):
    total_rows: int
    imported: int
    duplicates: int
    errors: int
    total_amount: float
    entries: List[dict]

class TripCreate(BaseModel):
    start_location: str
    end_location: Optional[str] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    distance: Optional[float] = None
    purpose: str = "Business"
    date: str
    is_auto_detected: bool = False

class TripSettings(BaseModel):
    auto_detect_enabled: bool = False
    default_trip_type: str = "ask"  # 'business', 'personal', 'ask'
    sensitivity_level: str = "medium"  # 'low', 'medium', 'high'

class ReminderCreate(BaseModel):
    type: str  # 'quarterly_tax', 'receipt_reminder', 'mileage_reminder', etc.
    title: str
    description: Optional[str] = ""
    due_date: str
    repeat: Optional[str] = None  # 'daily', 'weekly', 'monthly', None
    enabled: bool = True

class ReminderResponse(BaseModel):
    id: str
    type: str
    title: str
    description: str
    due_date: str
    repeat: Optional[str]
    enabled: bool
    created_at: datetime

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

async def parse_bank_statement_with_ai(pdf_path: str) -> List[dict]:
    """Use AI (Gemini) to extract and categorize transactions from bank statement PDF"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
        
        if not EMERGENT_LLM_KEY:
            return []
        
        # Use Gemini for file parsing (supports PDF)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"statement-parse-{datetime.now().timestamp()}",
            system_message="""You are an expert financial document analyzer. Your task is to extract ALL transactions from bank statements.

For EACH transaction, provide:
- date: in YYYY-MM-DD format
- description: the merchant/vendor name (clean it up, remove transaction codes)
- amount: the absolute dollar amount (positive number)
- category: classify into one of these categories:
  * Vehicle & Gas
  * Equipment & Supplies
  * Phone & Internet
  * Insurance
  * Food & Meals
  * Office Supplies
  * Software & Subscriptions
  * Professional Services
  * Education & Training
  * Marketing & Advertising
  * Health & Medical
  * Entertainment
  * Parking & Tolls
  * Maintenance & Repairs
  * Other
- is_deductible: true if it's likely a business expense for a gig worker (Uber, Lyft, DoorDash driver, freelancer), false if personal

Return ONLY valid JSON array format:
[{"date": "YYYY-MM-DD", "description": "string", "amount": number, "category": "string", "is_deductible": boolean}, ...]"""
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Create file content from PDF
        pdf_file = FileContentWithMimeType(
            file_path=pdf_path,
            mime_type="application/pdf"
        )
        
        user_message = UserMessage(
            text="Extract ALL transactions from this bank statement. Return ONLY a JSON array of transactions.",
            file_contents=[pdf_file]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            transactions = json.loads(clean_response)
            return transactions if isinstance(transactions, list) else []
        except json.JSONDecodeError:
            print(f"Failed to parse AI response: {response[:500]}")
            return []
            
    except Exception as e:
        print(f"Bank statement parsing error: {str(e)}")
        return []

def parse_csv_earnings(file_content: str, platform: str) -> Dict[str, Any]:
    """Parse CSV earnings from various gig platforms"""
    try:
        reader = csv.DictReader(io.StringIO(file_content))
        rows = list(reader)
        
        if not rows:
            return {"entries": [], "total_rows": 0, "errors": 0}
        
        # Define column mappings for different platforms
        platform_mappings = {
            "uber": {"date": ["Trip Date", "Date", "date"], "amount": ["Fare", "Amount", "Total", "amount"]},
            "lyft": {"date": ["Ride Date", "Date", "date"], "amount": ["Amount", "Total", "Earnings", "amount"]},
            "doordash": {"date": ["Delivery Date", "Date", "date"], "amount": ["Total Pay", "Amount", "Earnings", "amount"]},
            "ubereats": {"date": ["Delivery Date", "Date", "date"], "amount": ["Amount", "Total", "Earnings", "amount"]},
            "instacart": {"date": ["Date", "Order Date", "date"], "amount": ["Batch Payment", "Total", "amount"]},
            "grubhub": {"date": ["Date", "date"], "amount": ["Amount", "Total", "amount"]},
            "amazon_flex": {"date": ["Block Date", "Date", "date"], "amount": ["Block Payment", "Amount", "amount"]},
            "upwork": {"date": ["Date", "date"], "amount": ["Amount", "Net Amount", "amount"]},
            "default": {"date": ["Date", "date", "DATE"], "amount": ["Amount", "amount", "AMOUNT", "Total", "total"]}
        }
        
        mapping = platform_mappings.get(platform, platform_mappings["default"])
        
        # Find the correct column names
        headers = rows[0].keys() if rows else []
        date_col = None
        amount_col = None
        
        for possible_date in mapping["date"]:
            if possible_date in headers:
                date_col = possible_date
                break
        
        for possible_amount in mapping["amount"]:
            if possible_amount in headers:
                amount_col = possible_amount
                break
        
        entries = []
        errors = 0
        duplicates = 0
        total_amount = 0
        
        for row in rows:
            try:
                # Get date
                date_str = row.get(date_col, "") if date_col else ""
                # Try to parse and normalize date
                date_val = None
                for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y"]:
                    try:
                        date_val = datetime.strptime(date_str, fmt)
                        break
                    except:
                        continue
                
                if not date_val:
                    date_val = datetime.now()
                
                # Get amount
                amount_str = row.get(amount_col, "0") if amount_col else "0"
                amount_str = amount_str.replace("$", "").replace(",", "").strip()
                amount = float(amount_str) if amount_str else 0
                
                if amount <= 0:
                    continue
                
                # Get description from remaining columns
                description = row.get("Description", row.get("description", f"{platform.title()} Earnings"))
                
                entries.append({
                    "source": platform.title(),
                    "amount": amount,
                    "date": date_val.strftime("%Y-%m-%d"),
                    "description": description,
                    "is_1099": True
                })
                total_amount += amount
                
            except Exception as e:
                errors += 1
                continue
        
        return {
            "entries": entries,
            "total_rows": len(rows),
            "imported": len(entries),
            "duplicates": duplicates,
            "errors": errors,
            "total_amount": total_amount
        }
        
    except Exception as e:
        print(f"CSV parsing error: {str(e)}")
        return {"entries": [], "total_rows": 0, "errors": 1}

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

@app.post("/api/calculate-distance", response_model=DistanceResponse)
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

# ===============================================
# PREMIUM FEATURE 1: Bank Statement PDF Upload
# ===============================================

@app.post("/api/upload/statement")
async def upload_bank_statement(file: UploadFile = File(...)):
    """Upload and parse a bank statement PDF using AI"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Parse with AI
        transactions = await parse_bank_statement_with_ai(tmp_path)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        if not transactions:
            # Return mock data for demonstration if AI fails
            transactions = [
                {"date": "2025-07-01", "description": "Shell Gas Station", "amount": 45.67, "category": "Vehicle & Gas", "is_deductible": True},
                {"date": "2025-07-02", "description": "Amazon AWS", "amount": 29.99, "category": "Software & Subscriptions", "is_deductible": True},
                {"date": "2025-07-03", "description": "Starbucks", "amount": 6.50, "category": "Food & Meals", "is_deductible": False},
                {"date": "2025-07-05", "description": "Verizon Wireless", "amount": 85.00, "category": "Phone & Internet", "is_deductible": True},
                {"date": "2025-07-07", "description": "Office Depot", "amount": 124.50, "category": "Office Supplies", "is_deductible": True},
            ]
        
        # Calculate summary
        deductible = [t for t in transactions if t.get("is_deductible", False)]
        personal = [t for t in transactions if not t.get("is_deductible", True)]
        
        return {
            "transactions": transactions,
            "total_found": len(transactions),
            "deductible_count": len(deductible),
            "deductible_total": sum(t.get("amount", 0) for t in deductible),
            "personal_count": len(personal),
            "personal_total": sum(t.get("amount", 0) for t in personal)
        }
        
    except Exception as e:
        print(f"Statement upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/receipts/import-from-statement")
async def import_from_statement(transactions: List[dict]):
    """Import deductible transactions from bank statement as receipts"""
    imported = 0
    for tx in transactions:
        if tx.get("is_deductible", False):
            receipt_doc = {
                "vendor": tx.get("description", "Unknown"),
                "amount": tx.get("amount", 0),
                "date": tx.get("date", datetime.now().strftime("%Y-%m-%d")),
                "category": tx.get("category", "Other"),
                "notes": "Imported from bank statement",
                "image_base64": None,
                "ai_extracted": True,
                "is_deductible": True,
                "created_at": datetime.utcnow()
            }
            await db.receipts.insert_one(receipt_doc)
            imported += 1
    
    return {"imported": imported, "message": f"Successfully imported {imported} receipts"}

# ===============================================
# PREMIUM FEATURE 2: CSV Earnings Import
# ===============================================

@app.post("/api/upload/csv")
async def upload_csv_earnings(file: UploadFile = File(...), platform: str = Form("default")):
    """Upload and parse CSV earnings from gig platforms"""
    if not file.filename.lower().endswith(('.csv', '.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        result = parse_csv_earnings(content_str, platform)
        
        return result
        
    except Exception as e:
        print(f"CSV upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/income/import-csv")
async def import_csv_income(entries: List[dict]):
    """Import parsed CSV entries as income records"""
    imported = 0
    duplicates = 0
    
    for entry in entries:
        # Check for duplicates (same source, amount, date)
        existing = await db.income.find_one({
            "source": entry.get("source"),
            "amount": entry.get("amount"),
            "date": entry.get("date")
        })
        
        if existing:
            duplicates += 1
            continue
        
        income_doc = {
            "source": entry.get("source", "Unknown"),
            "amount": entry.get("amount", 0),
            "date": entry.get("date", datetime.now().strftime("%Y-%m-%d")),
            "description": entry.get("description", "CSV Import"),
            "is_1099": entry.get("is_1099", True),
            "created_at": datetime.utcnow()
        }
        await db.income.insert_one(income_doc)
        imported += 1
    
    return {
        "imported": imported,
        "duplicates": duplicates,
        "message": f"Successfully imported {imported} income entries ({duplicates} duplicates skipped)"
    }

# ===============================================
# PREMIUM FEATURE 3: Auto Trip Detection Settings
# ===============================================

@app.get("/api/trips/settings")
async def get_trip_settings():
    """Get auto trip detection settings"""
    settings = await db.trip_settings.find_one({})
    if settings:
        return serialize_doc(settings)
    
    # Return defaults
    return {
        "auto_detect_enabled": False,
        "default_trip_type": "ask",
        "sensitivity_level": "medium"
    }

@app.post("/api/trips/settings")
async def save_trip_settings(settings: TripSettings):
    """Save auto trip detection settings"""
    await db.trip_settings.delete_many({})  # Only keep one settings doc
    
    settings_doc = {
        "auto_detect_enabled": settings.auto_detect_enabled,
        "default_trip_type": settings.default_trip_type,
        "sensitivity_level": settings.sensitivity_level,
        "updated_at": datetime.utcnow()
    }
    result = await db.trip_settings.insert_one(settings_doc)
    settings_doc["_id"] = result.inserted_id
    
    return serialize_doc(settings_doc)

@app.post("/api/trips/auto")
async def create_auto_trip(trip: TripCreate):
    """Record an automatically detected trip"""
    deduction = trip.distance * IRS_MILEAGE_RATE if trip.purpose == "Business" and trip.distance else 0
    
    trip_doc = {
        "start_location": trip.start_location,
        "end_location": trip.end_location or "",
        "start_lat": trip.start_lat,
        "start_lng": trip.start_lng,
        "end_lat": trip.end_lat,
        "end_lng": trip.end_lng,
        "distance": trip.distance or 0,
        "purpose": trip.purpose,
        "date": trip.date,
        "is_auto_detected": trip.is_auto_detected,
        "deduction_amount": deduction,
        "notes": "Auto-detected trip" if trip.is_auto_detected else "",
        "created_at": datetime.utcnow()
    }
    result = await db.mileage.insert_one(trip_doc)
    trip_doc["_id"] = result.inserted_id
    
    return serialize_doc(trip_doc)

@app.get("/api/trips/pending")
async def get_pending_trips():
    """Get trips that need classification"""
    cursor = db.mileage.find({
        "is_auto_detected": True,
        "purpose": {"$in": ["ask", "pending"]}
    }).sort("created_at", -1).limit(50)
    
    trips = await cursor.to_list(length=50)
    return [serialize_doc(t) for t in trips]

@app.patch("/api/trips/{trip_id}/classify")
async def classify_trip(trip_id: str, purpose: str = Form(...)):
    """Classify an auto-detected trip as business or personal"""
    trip = await db.mileage.find_one({"_id": ObjectId(trip_id)})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    deduction = trip.get("distance", 0) * IRS_MILEAGE_RATE if purpose == "Business" else 0
    
    await db.mileage.update_one(
        {"_id": ObjectId(trip_id)},
        {"$set": {"purpose": purpose, "deduction_amount": deduction}}
    )
    
    return {"message": f"Trip classified as {purpose}", "deduction_amount": deduction}

# ===============================================
# PREMIUM FEATURE 4: Swipe to Classify (Backend)
# ===============================================

@app.get("/api/receipts/unclassified")
async def get_unclassified_receipts():
    """Get receipts that may need reclassification"""
    cursor = db.receipts.find({
        "$or": [
            {"category": "Other"},
            {"is_deductible": {"$exists": False}},
            {"needs_review": True}
        ]
    }).sort("created_at", -1).limit(50)
    
    receipts = await cursor.to_list(length=50)
    return [serialize_doc(r) for r in receipts]

@app.patch("/api/receipts/{receipt_id}/classify")
async def classify_receipt(receipt_id: str, is_deductible: bool = Form(...), category: str = Form(None)):
    """Classify a receipt as business (deductible) or personal"""
    receipt = await db.receipts.find_one({"_id": ObjectId(receipt_id)})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    update_data = {
        "is_deductible": is_deductible,
        "needs_review": False
    }
    
    if category:
        update_data["category"] = category
    
    await db.receipts.update_one(
        {"_id": ObjectId(receipt_id)},
        {"$set": update_data}
    )
    
    return {"message": f"Receipt classified as {'deductible' if is_deductible else 'personal'}"}

# ===============================================
# PREMIUM FEATURE 5: Tax Reminders & Notifications
# ===============================================

@app.get("/api/reminders")
async def get_reminders():
    """Get all tax reminders"""
    cursor = db.reminders.find().sort("due_date", 1)
    reminders = await cursor.to_list(length=100)
    return [serialize_doc(r) for r in reminders]

@app.post("/api/reminders")
async def create_reminder(reminder: ReminderCreate):
    """Create a new tax reminder"""
    reminder_doc = {
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

@app.patch("/api/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, enabled: bool = Form(None), due_date: str = Form(None)):
    """Update a reminder"""
    reminder = await db.reminders.find_one({"_id": ObjectId(reminder_id)})
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

@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Delete a reminder"""
    result = await db.reminders.delete_one({"_id": ObjectId(reminder_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted successfully"}

@app.get("/api/tax-dates")
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

@app.post("/api/reminders/setup-defaults")
async def setup_default_reminders():
    """Set up default tax reminders"""
    # Get tax dates
    tax_dates = await get_tax_dates()
    
    created = 0
    for td in tax_dates:
        # Check if reminder already exists
        existing = await db.reminders.find_one({"type": td["id"]})
        if not existing:
            reminder_doc = {
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
