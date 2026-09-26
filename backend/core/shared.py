"""Shared models, constants and AI helper functions."""
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
from pydantic import BaseModel, Field

from core.database import db

load_dotenv()



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
    is_business: Optional[bool] = None
    store_id: Optional[str] = None
    barcode: Optional[str] = None
    line_items: Optional[List[dict]] = None

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
    store_id: Optional[str] = None

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
    store_id: Optional[str] = None

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
    "Inventory & Stock": {"deductible": True, "category_type": "business"},
    "Fuel": {"deductible": True, "category_type": "business"},
    "Travel": {"deductible": True, "category_type": "business"},
    "Bank Fees": {"deductible": True, "category_type": "business"},
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
        ).with_model("anthropic", "claude-sonnet-4-6")
        
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
        ).with_model("anthropic", "claude-sonnet-4-6")
        
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
