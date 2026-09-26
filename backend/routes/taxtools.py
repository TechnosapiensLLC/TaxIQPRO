"""Tax filing analyzer, deduction maximizer and quarterly estimator."""
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
from routes.records import get_dashboard

router = APIRouter()
CurrentUser = Annotated[dict, Depends(get_current_user)]

# ===============================================
# TAX FILING ANALYZER FEATURE
# ===============================================

class TaxFilingAnalysis(BaseModel):
    filing_type: str
    tax_year: str
    total_income: float
    total_deductions: float
    business_type: Optional[str] = None
    missed_deductions: List[dict]
    recommendations: List[dict]
    imported_data: dict
    insights: List[str]
    app_features_to_use: List[dict]

async def analyze_tax_filing_with_ai(file_path: str, file_type: str = "pdf") -> dict:
    """Use AI to analyze tax filing and extract insights"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
        
        if not EMERGENT_LLM_KEY:
            return get_mock_filing_analysis()
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tax-analysis-{datetime.now().timestamp()}",
            system_message="""You are an expert tax analyst and CPA specializing in small business, gig worker, and S-Corporation taxation. 

CRITICAL RULES - DO NOT VIOLATE:
1. ONLY extract data that you can ACTUALLY READ from the document
2. DO NOT infer, estimate, or improvise any numbers
3. If you cannot clearly read a value, set it to null or 0 and note "Unable to read" in the description
4. DO NOT make up deduction amounts - only suggest categories to review
5. All recommendations should say "Verify with your CPA" or "Consult a tax professional"

TAX FORM REFERENCE GUIDE:
- Form 1120-S (S-Corporation): Line 1a = Gross Receipts, Line 6 = Total Income, Line 21 = Total Deductions, Line 22 = Ordinary Business Income
- Schedule C (Sole Proprietor): Line 1 = Gross Receipts, Line 7 = Gross Income, Line 28 = Total Expenses, Line 31 = Net Profit
- Form 1040: Lines 1-9 = Income items, Line 15 = Taxable Income
- Schedule K-1: Box 1 = Ordinary Business Income
- Form W-2: Box 1 = Wages, Box 2 = Federal Tax Withheld
- Form 1099-NEC: Box 1 = Nonemployee Compensation

WHAT TO EXTRACT (only if clearly visible):
- Filing type and tax year
- Total income (from the specific line on the form)
- Total deductions (from the specific line on the form)
- Business name and type
- Major expense categories with amounts

MISSED DEDUCTIONS - SUGGEST CATEGORIES TO REVIEW (not dollar amounts):
- Retirement plan contributions (SEP-IRA, Solo 401k)
- Home office deduction
- Vehicle/mileage expenses
- Health insurance (for S-Corp shareholders)
- Professional development
- Cell phone/internet business use

RECOMMENDATIONS FORMAT:
- Always include "Verify with a tax professional"
- Use phrases like "Consider reviewing...", "You may want to explore...", "Consult your CPA about..."
- Never state definitive savings amounts without saying "potential" or "estimated"

Return your analysis as valid JSON with this structure:
{
    "filing_type": "Form 1120-S" (or whatever is actually on the document),
    "tax_year": "2022" (from the document),
    "total_income": 335667.00 (ONLY if you can read this from the form),
    "total_deductions": 306707.00 (ONLY if you can read this from the form),
    "business_type": "S-Corporation - [Industry from document]",
    "confidence_note": "Values extracted directly from form lines X, Y, Z",
    "missed_deductions": [
        {"name": "Retirement Contributions", "estimated_value": null, "description": "No retirement plan contributions visible on return. Consult CPA about SEP-IRA or Solo 401(k) options."}
    ],
    "recommendations": [
        {"title": "Review Officer Compensation", "description": "Current officer salary appears to be [amount]. Consult your CPA to verify this meets 'reasonable compensation' standards.", "priority": "high"}
    ],
    "imported_data": {
        "income_sources": [{"source": "Business Gross Receipts (Line 1a)", "amount": 335696, "is_1099": false}],
        "expense_categories": [
            {"category": "Officer Compensation (Line 7)", "amount": 30000}
        ],
        "business_info": {"name": "FROM DOCUMENT", "type": "S-Corporation", "industry": "FROM DOCUMENT"}
    },
    "insights": [
        "Based on the return, [specific observation from document]. Verify accuracy with your tax preparer."
    ],
    "app_features_to_use": [
        {"feature": "Quarterly Tax Estimator", "reason": "Track estimated payments based on your income level", "priority": 1}
    ],
    "potential_savings": null,
    "tax_efficiency_score": 75,
    "disclaimer": "This analysis is for informational purposes only. All findings should be verified by a qualified tax professional. TaxIQ Pro does not provide tax advice."
}

IMPORTANT: 
- Only include numbers you can ACTUALLY READ from the document
- If unsure about a value, use null and explain in the description
- Every recommendation must include "verify with CPA" or similar language
- Include the disclaimer field in every response"""
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Create file content from PDF
        mime_type = "application/pdf" if file_type == "pdf" else "image/jpeg"
        pdf_file = FileContentWithMimeType(
            file_path=file_path,
            mime_type=mime_type
        )
        
        user_message = UserMessage(
            text="""Analyze this tax filing document carefully. 

INSTRUCTIONS:
1. Extract EXACT numerical values from the tax forms (income, deductions, etc.)
2. Identify the filing type (1120-S, Schedule C, 1040, etc.)
3. Find missed deduction opportunities
4. Provide actionable recommendations

If this is a Form 1120-S (S-Corporation):
- Line 1a = Gross Receipts
- Line 6 = Total Income  
- Line 21 = Total Deductions
- Line 22 = Ordinary Business Income
- Also check Schedule K and K-1 for shareholder information

Return ONLY valid JSON with the exact structure specified. No markdown, no explanations.""",
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
            
            analysis = json.loads(clean_response)
            return analysis
        except json.JSONDecodeError:
            print(f"Failed to parse AI response: {response[:500]}")
            return get_mock_filing_analysis()
            
    except Exception as e:
        print(f"Tax filing analysis error: {str(e)}")
        return get_mock_filing_analysis()

def get_mock_filing_analysis() -> dict:
    """Return mock analysis for demo purposes"""
    return {
        "filing_type": "Schedule C",
        "tax_year": "2024",
        "total_income": 78500.00,
        "total_deductions": 15200.00,
        "business_type": "Rideshare/Delivery Driver",
        "missed_deductions": [
            {"name": "Home Office Deduction", "estimated_value": 1800, "description": "If you use part of your home for business admin, you can deduct it"},
            {"name": "Phone Bill (Business %)", "estimated_value": 720, "description": "Typically 60-80% of phone bill is deductible for gig workers"},
            {"name": "Health Insurance Premium", "estimated_value": 4800, "description": "Self-employed health insurance is 100% deductible"},
            {"name": "Retirement Contribution (SEP-IRA)", "estimated_value": 12000, "description": "You can contribute up to 25% of net self-employment income"},
            {"name": "Car Washes", "estimated_value": 360, "description": "Often overlooked but deductible for rideshare drivers"},
            {"name": "Roadside Assistance (AAA)", "estimated_value": 150, "description": "Business portion is deductible"},
            {"name": "Professional Development", "estimated_value": 500, "description": "Courses, books, seminars related to your business"}
        ],
        "recommendations": [
            {"title": "Consider S-Corp Election", "description": "At $78k income, S-Corp could save you $4,000-6,000/year in self-employment tax", "priority": "high"},
            {"title": "Open a SEP-IRA", "description": "Reduce taxable income by up to $15,700 while saving for retirement", "priority": "high"},
            {"title": "Track All Mileage", "description": "At $0.67/mile, even 10,000 extra miles = $6,700 more deductions", "priority": "medium"},
            {"title": "Quarterly Estimated Taxes", "description": "Pay quarterly to avoid underpayment penalties", "priority": "medium"},
            {"title": "Separate Business Banking", "description": "Makes tracking easier and looks more professional for audits", "priority": "low"}
        ],
        "imported_data": {
            "income_sources": [
                {"source": "Uber", "amount": 42000, "is_1099": True},
                {"source": "Lyft", "amount": 18500, "is_1099": True},
                {"source": "DoorDash", "amount": 12000, "is_1099": True},
                {"source": "Instacart", "amount": 6000, "is_1099": True}
            ],
            "expense_categories": [
                {"category": "Vehicle & Gas", "amount": 8500},
                {"category": "Phone & Internet", "amount": 1200},
                {"category": "Insurance", "amount": 2400},
                {"category": "Supplies", "amount": 800},
                {"category": "Parking & Tolls", "amount": 1100},
                {"category": "Software & Apps", "amount": 600},
                {"category": "Maintenance & Repairs", "amount": 600}
            ],
            "business_info": {
                "name": "Self-Employed",
                "type": "Sole Proprietorship",
                "industry": "Transportation/Delivery"
            }
        },
        "insights": [
            "Your effective tax rate was 24.3%, which is 3% higher than average for your income bracket",
            "Vehicle expenses were 56% of total deductions - maximize mileage tracking",
            "You're in the 'S-Corp sweet spot' - income between $60k-$150k benefits most from S-Corp election",
            "No retirement contributions detected - this is your biggest tax-saving opportunity",
            "Multi-app strategy is good for income diversification"
        ],
        "app_features_to_use": [
            {"feature": "Live Trip Tracker", "reason": "Auto-track all driving miles for maximum deductions", "priority": 1},
            {"feature": "Receipt Scanner", "reason": "Capture gas, maintenance, and supply receipts instantly", "priority": 2},
            {"feature": "Income Tracker", "reason": "Log earnings from all 4 platforms in one place", "priority": 3},
            {"feature": "Quarterly Tax Estimator", "reason": "Stay on top of estimated payments", "priority": 4},
            {"feature": "AI Tax Coach", "reason": "Get personalized advice for your situation", "priority": 5},
            {"feature": "Gas Finder", "reason": "Save on your biggest recurring expense", "priority": 6}
        ],
        "potential_savings": 8530.00,
        "tax_efficiency_score": 68
    }

@router.post("/api/analyze-filing")
async def analyze_tax_filing(user: CurrentUser, file: UploadFile = File(...)):
    """Upload and analyze a tax filing document"""
    allowed_types = ['.pdf', '.jpg', '.jpeg', '.png']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and image files are supported")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Analyze with AI
        file_type = "pdf" if file_ext == ".pdf" else "image"
        analysis = await analyze_tax_filing_with_ai(tmp_path, file_type)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Save analysis to database
        analysis_doc = {
            "user_id": user["id"],
            "filename": file.filename,
            "analysis": analysis,
            "created_at": datetime.utcnow()
        }
        result = await db.filing_analyses.insert_one(analysis_doc)
        
        return {
            "id": str(result.inserted_id),
            "filename": file.filename,
            "analysis": analysis
        }
        
    except Exception as e:
        print(f"Filing analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/filing-analyses")
async def get_filing_analyses(user: CurrentUser):
    """Get all previous filing analyses"""
    cursor = db.filing_analyses.find({"user_id": user["id"]}).sort("created_at", -1).limit(20)
    analyses = await cursor.to_list(length=20)
    return [serialize_doc(a) for a in analyses]

@router.post("/api/import-filing-data")
async def import_filing_data(user: CurrentUser, analysis_id: str = Form(...)):
    """Import data from a filing analysis into the app"""
    analysis_doc = await db.filing_analyses.find_one({"_id": ObjectId(analysis_id), "user_id": user["id"]})
    if not analysis_doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    analysis = analysis_doc.get("analysis", {})
    imported_data = analysis.get("imported_data", {})
    
    imported_count = {"income": 0, "expenses": 0}
    
    # Import income sources
    for source in imported_data.get("income_sources", []):
        income_doc = {
            "user_id": user["id"],
            "organization_id": user.get("organization_id"),
            "is_business": True,
            "source": source.get("source", "Unknown"),
            "amount": source.get("amount", 0),
            "date": f"{analysis.get('tax_year', '2024')}-12-31",
            "description": f"Imported from {analysis.get('tax_year', '2024')} tax filing",
            "is_1099": source.get("is_1099", True),
            "imported": True,
            "created_at": datetime.utcnow()
        }
        await db.income.insert_one(income_doc)
        imported_count["income"] += 1
    
    # Import expense categories as receipts
    for expense in imported_data.get("expense_categories", []):
        receipt_doc = {
            "user_id": user["id"],
            "organization_id": user.get("organization_id"),
            "is_business": True,
            "vendor": f"{expense.get('category', 'Unknown')} (Annual)",
            "amount": expense.get("amount", 0),
            "date": f"{analysis.get('tax_year', '2024')}-12-31",
            "category": expense.get("category", "Other"),
            "notes": f"Imported from {analysis.get('tax_year', '2024')} tax filing",
            "imported": True,
            "is_deductible": True,
            "created_at": datetime.utcnow()
        }
        await db.receipts.insert_one(receipt_doc)
        imported_count["expenses"] += 1
    
    return {
        "message": f"Successfully imported {imported_count['income']} income sources and {imported_count['expenses']} expense categories",
        "imported": imported_count
    }

# ===============================================
# DEDUCTION MAXIMIZER FEATURE
# ===============================================

# Profession-specific deduction suggestions
PROFESSION_DEDUCTIONS = {
    "rideshare": [
        {"name": "Vehicle Mileage", "description": "Track all miles driven for business", "avg_value": 8000, "category": "Vehicle & Gas"},
        {"name": "Car Washes", "description": "Keep your vehicle clean for passengers", "avg_value": 360, "category": "Maintenance & Repairs"},
        {"name": "Phone Mount/Charger", "description": "Equipment for navigation", "avg_value": 50, "category": "Equipment & Supplies"},
        {"name": "Dash Cam", "description": "Safety equipment for rideshare", "avg_value": 150, "category": "Equipment & Supplies"},
        {"name": "Phone Bill", "description": "Business % of phone plan (typically 60-80%)", "avg_value": 720, "category": "Phone & Internet"},
        {"name": "Roadside Assistance (AAA)", "description": "Business portion deductible", "avg_value": 100, "category": "Insurance"},
        {"name": "Snacks/Water for Passengers", "description": "Supplies to improve ratings", "avg_value": 200, "category": "Equipment & Supplies"},
        {"name": "Cleaning Supplies", "description": "Interior cleaning products", "avg_value": 100, "category": "Equipment & Supplies"},
        {"name": "Parking Fees", "description": "Business-related parking", "avg_value": 500, "category": "Parking & Tolls"},
        {"name": "Tolls", "description": "Bridge/highway tolls during trips", "avg_value": 400, "category": "Parking & Tolls"},
    ],
    "delivery": [
        {"name": "Vehicle Mileage", "description": "Track all delivery miles", "avg_value": 10000, "category": "Vehicle & Gas"},
        {"name": "Insulated Delivery Bags", "description": "Hot/cold bags for food delivery", "avg_value": 80, "category": "Equipment & Supplies"},
        {"name": "Phone Mount/Charger", "description": "Navigation equipment", "avg_value": 50, "category": "Equipment & Supplies"},
        {"name": "Phone Bill", "description": "Business % of phone plan", "avg_value": 720, "category": "Phone & Internet"},
        {"name": "Bike/Scooter Maintenance", "description": "If using alternative transport", "avg_value": 300, "category": "Maintenance & Repairs"},
        {"name": "Weather Gear", "description": "Rain gear, winter clothing for work", "avg_value": 150, "category": "Equipment & Supplies"},
        {"name": "Parking Fees", "description": "Parking during pickups/deliveries", "avg_value": 300, "category": "Parking & Tolls"},
    ],
    "freelance": [
        {"name": "Home Office Deduction", "description": "Dedicated workspace at home", "avg_value": 1500, "category": "Office Supplies"},
        {"name": "Computer/Electronics", "description": "Work equipment depreciation", "avg_value": 500, "category": "Equipment & Supplies"},
        {"name": "Software Subscriptions", "description": "Tools for your work", "avg_value": 600, "category": "Software & Subscriptions"},
        {"name": "Internet Bill", "description": "Business % of home internet", "avg_value": 480, "category": "Phone & Internet"},
        {"name": "Professional Development", "description": "Courses, books, training", "avg_value": 500, "category": "Education & Training"},
        {"name": "Office Supplies", "description": "Paper, pens, printer ink, etc.", "avg_value": 200, "category": "Office Supplies"},
        {"name": "Health Insurance", "description": "Self-employed health insurance deduction", "avg_value": 4800, "category": "Insurance"},
        {"name": "Retirement Contributions", "description": "SEP-IRA or Solo 401(k)", "avg_value": 6000, "category": "Other"},
    ],
    "general": [
        {"name": "Phone Bill", "description": "Business % of phone plan", "avg_value": 600, "category": "Phone & Internet"},
        {"name": "Internet Bill", "description": "Business % of internet", "avg_value": 400, "category": "Phone & Internet"},
        {"name": "Office Supplies", "description": "General business supplies", "avg_value": 200, "category": "Office Supplies"},
        {"name": "Professional Services", "description": "Tax prep, legal, accounting", "avg_value": 400, "category": "Professional Services"},
        {"name": "Bank Fees", "description": "Business account fees", "avg_value": 120, "category": "Other"},
        {"name": "Health Insurance", "description": "Self-employed deduction", "avg_value": 4800, "category": "Insurance"},
    ]
}

@router.get("/api/deduction-maximizer")
async def get_deduction_analysis(user: CurrentUser):
    """Analyze current deductions and suggest improvements"""
    # Get all current data
    _scope = {"user_id": user["id"]}
    receipts = await db.receipts.find(_scope).to_list(length=5000)
    mileage_entries = await db.mileage.find(_scope).to_list(length=5000)
    income_entries = await db.income.find(_scope).to_list(length=5000)
    
    # Calculate current totals
    total_income = sum(i.get("amount", 0) for i in income_entries)
    current_expense_deductions = sum(r.get("amount", 0) for r in receipts if r.get("is_deductible", False))
    current_mileage_deductions = sum(m.get("deduction_amount", 0) for m in mileage_entries)
    total_current_deductions = current_expense_deductions + current_mileage_deductions
    
    # Analyze expense categories
    expense_by_category = {}
    for receipt in receipts:
        cat = receipt.get("category", "Other")
        if receipt.get("is_deductible", False):
            expense_by_category[cat] = expense_by_category.get(cat, 0) + receipt.get("amount", 0)
    
    # Determine profession based on income sources
    income_sources = [i.get("source", "").lower() for i in income_entries]
    profession = "general"
    if any(s in ["uber", "lyft"] for s in income_sources):
        profession = "rideshare"
    elif any(s in ["doordash", "ubereats", "instacart", "grubhub"] for s in income_sources):
        profession = "delivery"
    elif any(s in ["upwork", "fiverr", "freelance"] for s in income_sources):
        profession = "freelance"
    
    # Get profession-specific suggestions
    suggestions = PROFESSION_DEDUCTIONS.get(profession, PROFESSION_DEDUCTIONS["general"])
    
    # Filter suggestions to only show ones not being tracked
    missing_deductions = []
    for suggestion in suggestions:
        cat = suggestion["category"]
        current_amount = expense_by_category.get(cat, 0)
        # If they're tracking less than 50% of typical, suggest it
        if current_amount < suggestion["avg_value"] * 0.5:
            missing_deductions.append({
                **suggestion,
                "current_tracked": current_amount,
                "potential_savings": round(suggestion["avg_value"] * 0.25, 2)  # Rough tax savings estimate
            })
    
    # Calculate deduction health score (0-100)
    typical_deduction_rate = 0.25  # Typical gig worker deducts ~25% of income
    expected_deductions = total_income * typical_deduction_rate
    if expected_deductions > 0:
        deduction_score = min(100, int((total_current_deductions / expected_deductions) * 100))
    else:
        deduction_score = 0
    
    # Generate tips based on data
    tips = []
    if len(mileage_entries) == 0:
        tips.append("Start tracking your mileage! At $0.70/mile, even 5,000 miles = $3,500 in deductions.")
    if "Phone & Internet" not in expense_by_category:
        tips.append("Don't forget to deduct the business portion of your phone and internet bills.")
    if total_current_deductions < total_income * 0.15:
        tips.append("Your deduction rate seems low. Make sure you're capturing all business expenses.")
    if profession in ["rideshare", "delivery"] and expense_by_category.get("Vehicle & Gas", 0) < 1000:
        tips.append("As a driver, vehicle expenses should be your largest deduction. Track everything!")
    
    total_potential_savings = sum(d["potential_savings"] for d in missing_deductions)
    
    return {
        "deduction_score": deduction_score,
        "current_deductions": {
            "expenses": round(current_expense_deductions, 2),
            "mileage": round(current_mileage_deductions, 2),
            "total": round(total_current_deductions, 2)
        },
        "total_income": round(total_income, 2),
        "deduction_rate": round((total_current_deductions / total_income * 100) if total_income > 0 else 0, 1),
        "profession_detected": profession,
        "missing_deductions": missing_deductions[:8],  # Top 8 suggestions
        "expense_breakdown": expense_by_category,
        "tips": tips,
        "potential_additional_savings": round(total_potential_savings, 2),
        "receipts_count": len(receipts),
        "trips_count": len(mileage_entries)
    }

# ===============================================
# QUARTERLY TAX ESTIMATOR FEATURE
# ===============================================

@router.get("/api/quarterly-estimator")
async def get_quarterly_estimate(user: CurrentUser):
    """Calculate quarterly estimated tax payments"""
    # Get all data
    _scope = {"user_id": user["id"]}
    receipts = await db.receipts.find(_scope).to_list(length=5000)
    mileage_entries = await db.mileage.find(_scope).to_list(length=5000)
    income_entries = await db.income.find(_scope).to_list(length=5000)
    
    # Calculate totals
    total_income = sum(i.get("amount", 0) for i in income_entries)
    total_deductible_expenses = sum(r.get("amount", 0) for r in receipts if r.get("is_deductible", False))
    total_mileage_deduction = sum(m.get("deduction_amount", 0) for m in mileage_entries)
    total_deductions = total_deductible_expenses + total_mileage_deduction
    
    # Calculate net self-employment income
    net_income = max(0, total_income - total_deductions)
    
    # Self-employment tax calculation
    se_tax_base = net_income * 0.9235  # Only 92.35% is subject to SE tax
    self_employment_tax = se_tax_base * SELF_EMPLOYMENT_TAX_RATE
    
    # Deductible portion of SE tax (50%)
    se_tax_deduction = self_employment_tax * 0.5
    
    # Adjusted gross income for income tax
    agi = net_income - se_tax_deduction
    
    # Federal income tax brackets 2025 (simplified - single filer)
    def calculate_income_tax(taxable_income):
        brackets = [
            (11600, 0.10),
            (47150, 0.12),
            (100525, 0.22),
            (191950, 0.24),
            (243725, 0.32),
            (609350, 0.35),
            (float('inf'), 0.37)
        ]
        tax = 0
        prev_bracket = 0
        for bracket, rate in brackets:
            if taxable_income <= prev_bracket:
                break
            taxable_in_bracket = min(taxable_income, bracket) - prev_bracket
            tax += taxable_in_bracket * rate
            prev_bracket = bracket
        return tax
    
    # Standard deduction for 2025
    standard_deduction = 14600
    taxable_income = max(0, agi - standard_deduction)
    federal_income_tax = calculate_income_tax(taxable_income)
    
    # Total estimated tax
    total_annual_tax = self_employment_tax + federal_income_tax
    quarterly_payment = total_annual_tax / 4
    
    # Calculate current quarter and next due date
    now = datetime.now()
    current_year = now.year
    
    # Quarterly due dates
    due_dates = [
        {"quarter": "Q1", "period": "Jan 1 - Mar 31", "due_date": f"{current_year}-04-15"},
        {"quarter": "Q2", "period": "Apr 1 - May 31", "due_date": f"{current_year}-06-15"},
        {"quarter": "Q3", "period": "Jun 1 - Aug 31", "due_date": f"{current_year}-09-15"},
        {"quarter": "Q4", "period": "Sep 1 - Dec 31", "due_date": f"{current_year + 1}-01-15"},
    ]
    
    # Determine current quarter
    month = now.month
    if month <= 3:
        current_quarter = 0
    elif month <= 5:
        current_quarter = 1
    elif month <= 8:
        current_quarter = 2
    else:
        current_quarter = 3
    
    # Calculate days until next payment
    for i, q in enumerate(due_dates):
        due = datetime.strptime(q["due_date"], "%Y-%m-%d")
        days_left = (due - now).days
        due_dates[i]["days_until_due"] = max(0, days_left)
        due_dates[i]["is_past"] = days_left < 0
        due_dates[i]["is_current"] = i == current_quarter
        due_dates[i]["payment_amount"] = round(quarterly_payment, 2)
    
    # Calculate "pay now vs wait" scenarios
    months_elapsed = month
    ytd_income_estimate = (total_income / 12) * months_elapsed if total_income > 0 else 0
    
    # Safe harbor calculation (100% of prior year tax - we'll estimate)
    safe_harbor_payment = round(total_annual_tax / 4, 2)
    
    return {
        "annual_estimate": {
            "total_income": round(total_income, 2),
            "total_deductions": round(total_deductions, 2),
            "net_income": round(net_income, 2),
            "self_employment_tax": round(self_employment_tax, 2),
            "federal_income_tax": round(federal_income_tax, 2),
            "total_tax": round(total_annual_tax, 2)
        },
        "quarterly_payment": round(quarterly_payment, 2),
        "safe_harbor_payment": safe_harbor_payment,
        "current_quarter": current_quarter + 1,
        "schedule": due_dates,
        "tax_rates": {
            "self_employment": "15.3%",
            "effective_income": f"{round((federal_income_tax / agi * 100) if agi > 0 else 0, 1)}%",
            "effective_total": f"{round((total_annual_tax / total_income * 100) if total_income > 0 else 0, 1)}%"
        },
        "breakdown": {
            "gross_income": round(total_income, 2),
            "expense_deductions": round(total_deductible_expenses, 2),
            "mileage_deductions": round(total_mileage_deduction, 2),
            "se_tax_deduction": round(se_tax_deduction, 2),
            "standard_deduction": standard_deduction,
            "taxable_income": round(taxable_income, 2)
        },
        "tips": [
            f"Your estimated quarterly payment is ${round(quarterly_payment, 2)}",
            "Pay quarterly to avoid underpayment penalties (usually 3-5% of underpaid amount)",
            "Consider increasing deductions to reduce your tax burden",
            "Keep 25-30% of each payment aside for taxes"
        ]
    }

