"""Shared helpers for building export datasets, CSV files and PDF documents."""
import csv
import io
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from core.database import db

IRS_MILEAGE_RATE = 0.67

# Our receipt categories -> Schedule C line
SCHEDULE_C_MAPPING = {
    "Vehicle & Gas": "Car and truck expenses (Line 9)",
    "Maintenance & Repairs": "Repairs and maintenance (Line 21)",
    "Phone & Internet": "Utilities (Line 25)",
    "Office Supplies": "Office expense (Line 18)",
    "Equipment & Supplies": "Supplies (Line 22)",
    "Software & Subscriptions": "Other expenses (Line 27a)",
    "Professional Services": "Legal and professional services (Line 17)",
    "Insurance": "Insurance (other than health) (Line 15)",
    "Parking & Tolls": "Car and truck expenses (Line 9)",
    "Education & Training": "Other expenses (Line 27a)",
    "Meals": "Meals (50% deductible) (Line 24b)",
    "Food & Meals": "Meals (50% deductible) (Line 24b)",
    "Travel": "Travel (Line 24a)",
    "Advertising": "Advertising (Line 8)",
    "Marketing & Advertising": "Advertising (Line 8)",
    "Bank Fees": "Other expenses (Line 27a)",
    "Inventory & Stock": "Cost of goods sold (Line 4)",
    "Fuel": "Car and truck expenses (Line 9)",
    "Other": "Other expenses (Line 27a)",
}

# Default chart-of-accounts names used by QuickBooks / Xero / Sage exports.
DEFAULT_COA = {
    "Vehicle & Gas": "Automobile:Fuel",
    "Fuel": "Automobile:Fuel",
    "Maintenance & Repairs": "Repairs and Maintenance",
    "Phone & Internet": "Utilities:Telephone",
    "Office Supplies": "Office Supplies",
    "Equipment & Supplies": "Supplies",
    "Software & Subscriptions": "Dues and Subscriptions",
    "Professional Services": "Legal & Professional Fees",
    "Insurance": "Insurance Expense",
    "Parking & Tolls": "Automobile:Parking and Tolls",
    "Education & Training": "Training & Education",
    "Meals": "Meals and Entertainment",
    "Travel": "Travel Expense",
    "Advertising": "Advertising & Promotion",
    "Marketing & Advertising": "Advertising & Promotion",
    "Food & Meals": "Meals and Entertainment",
    "Bank Fees": "Bank Service Charges",
    "Inventory & Stock": "Cost of Goods Sold",
    "Other": "Miscellaneous Expense",
}

MILEAGE_ACCOUNT = "Automobile:Mileage Reimbursement"
INCOME_ACCOUNT = "Sales Income"
CLEARING_ACCOUNT = "Owner Reimbursement Payable"


def _date_only(value) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    return str(value).split("T")[0]


def miles_of(row: dict) -> float:
    """Trips are stored with ``distance`` (legacy) and/or ``distance_miles``."""
    return float(row.get("distance_miles") or row.get("distance") or 0)


def us_date(value) -> str:
    iso = _date_only(value)
    try:
        return datetime.fromisoformat(iso).strftime("%m/%d/%Y")
    except ValueError:
        return iso


async def get_coa_mapping(user_id: str) -> dict:
    doc = await db.coa_mappings.find_one({"user_id": user_id})
    mapping = dict(DEFAULT_COA)
    if doc:
        mapping.update(doc.get("mapping", {}))
    return mapping


def account_for(mapping: dict, category: Optional[str]) -> str:
    return mapping.get(category or "Other", mapping.get("Other", "Miscellaneous Expense"))


async def collect_data(
    user_id: str,
    scope: str = "business",
    year: Optional[int] = None,
    store_id: Optional[str] = None,
) -> dict:
    """Pull the caller's receipts, mileage and income for an export.

    ``scope``: ``business`` (default, deductible only), ``personal`` or ``all``.
    """
    flt: dict = {"user_id": user_id}
    if scope == "business":
        flt["$or"] = [{"is_business": True}, {"is_business": {"$exists": False}}]
    elif scope == "personal":
        flt["is_business"] = False
    if store_id:
        flt["store_id"] = store_id
    if year:
        flt["date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31T23:59:59"}

    receipts = await db.receipts.find(flt).to_list(length=5000)
    mileage = await db.mileage.find(flt).to_list(length=5000)
    income = await db.income.find(flt).to_list(length=5000)

    if scope == "business":
        receipts = [r for r in receipts if r.get("is_deductible", True)]

    receipts.sort(key=lambda r: _date_only(r.get("date")))
    mileage.sort(key=lambda r: _date_only(r.get("date")))
    income.sort(key=lambda r: _date_only(r.get("date")))

    total_income = sum(float(i.get("amount", 0) or 0) for i in income)
    total_expenses = sum(float(r.get("amount", 0) or 0) for r in receipts)
    total_miles = sum(miles_of(m) for m in mileage)
    total_mileage_deduction = sum(
        float(m.get("deduction_amount", 0) or 0) or miles_of(m) * IRS_MILEAGE_RATE
        for m in mileage
    )

    expense_categories: dict = {}
    for r in receipts:
        cat = r.get("category") or "Other"
        expense_categories[cat] = expense_categories.get(cat, 0.0) + float(
            r.get("amount", 0) or 0
        )

    schedule_c_lines: dict = {}
    for cat, amount in expense_categories.items():
        line = SCHEDULE_C_MAPPING.get(cat, "Other expenses (Line 27a)")
        schedule_c_lines[line] = schedule_c_lines.get(line, 0.0) + amount
    if total_mileage_deduction > 0:
        line = "Car and truck expenses (Line 9)"
        schedule_c_lines[line] = schedule_c_lines.get(line, 0.0) + total_mileage_deduction

    income_by_source: dict = {}
    for i in income:
        src = i.get("source") or i.get("platform") or "Other"
        income_by_source[src] = income_by_source.get(src, 0.0) + float(
            i.get("amount", 0) or 0
        )

    return {
        "receipts": receipts,
        "mileage": mileage,
        "income": income,
        "tax_year": str(year) if year else str(datetime.now().year),
        "scope": scope,
        "totals": {
            "total_gross_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "total_mileage_miles": round(total_miles, 1),
            "total_mileage_deduction": round(total_mileage_deduction, 2),
            "total_deductions": round(total_expenses + total_mileage_deduction, 2),
            "net_profit": round(
                total_income - total_expenses - total_mileage_deduction, 2
            ),
        },
        "expense_categories": {k: round(v, 2) for k, v in expense_categories.items()},
        "schedule_c_lines": {k: round(v, 2) for k, v in schedule_c_lines.items()},
        "income_by_source": {k: round(v, 2) for k, v in income_by_source.items()},
    }


def csv_bytes(rows: list, header: list, bom: bool = True) -> bytes:
    """``bom`` adds a UTF-8 BOM so Excel opens the file cleanly.

    Accounting imports (QuickBooks / Xero / Sage) must be BOM-free or the first
    header cell is read as "\ufeffDate".
    """
    buf = io.StringIO(newline="")
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8-sig" if bom else "utf-8")


def multi_section_csv(sections: list) -> bytes:
    """sections: [(title, header, rows)] written one after another."""
    buf = io.StringIO(newline="")
    writer = csv.writer(buf)
    for index, (title, header, rows) in enumerate(sections):
        if index:
            writer.writerow([])
        writer.writerow([f"### {title}"])
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
    return buf.getvalue().encode("utf-8-sig")


def tsv_bytes(lines: list) -> bytes:
    return ("\n".join(lines) + "\n").encode("utf-8")


# --------------------------------------------------------------------------- #
# PDF helpers
# --------------------------------------------------------------------------- #

_styles = getSampleStyleSheet()
_TITLE = ParagraphStyle(
    "TaxIQTitle",
    parent=_styles["Title"],
    fontSize=20,
    textColor=colors.HexColor("#286C56"),
    spaceAfter=6,
)
_H2 = ParagraphStyle(
    "TaxIQH2",
    parent=_styles["Heading2"],
    fontSize=13,
    textColor=colors.HexColor("#1C1D1A"),
    spaceBefore=14,
    spaceAfter=6,
)
_BODY = ParagraphStyle("TaxIQBody", parent=_styles["BodyText"], fontSize=9, leading=12)
_SMALL = ParagraphStyle(
    "TaxIQSmall",
    parent=_styles["BodyText"],
    fontSize=7.5,
    leading=10,
    textColor=colors.HexColor("#5C635F"),
)


def pdf_table(header: list, rows: list, col_widths=None) -> Table:
    data = [header] + (rows or [["No records", *[""] * (len(header) - 1)]])
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#286C56")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B5BCB7")),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#F1F5F2")],
                ),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def build_pdf(title: str, subtitle: str, blocks: list) -> bytes:
    """blocks: list of ('heading'|'text'|'table'|'spacer'|'note', payload)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title=title,
    )
    story = [Paragraph(title, _TITLE), Paragraph(subtitle, _BODY), Spacer(1, 8)]
    for kind, payload in blocks:
        if kind == "heading":
            story.append(Paragraph(payload, _H2))
        elif kind == "text":
            story.append(Paragraph(payload, _BODY))
        elif kind == "note":
            story.append(Spacer(1, 6))
            story.append(Paragraph(payload, _SMALL))
        elif kind == "spacer":
            story.append(Spacer(1, payload))
        elif kind == "table":
            header, rows, widths = payload
            story.append(pdf_table(header, rows, widths))
    doc.build(story)
    return buf.getvalue()


def money(value) -> str:
    return f"${float(value or 0):,.2f}"
