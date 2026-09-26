"""Real file exports: TurboTax, Schedule C, mileage log, CPA package, accounting."""
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user

from .export_utils import (
    CLEARING_ACCOUNT,
    DEFAULT_COA,
    INCOME_ACCOUNT,
    IRS_MILEAGE_RATE,
    MILEAGE_ACCOUNT,
    SCHEDULE_C_MAPPING,
    account_for,
    build_pdf,
    collect_data,
    csv_bytes,
    get_coa_mapping,
    money,
    multi_section_csv,
    tsv_bytes,
    us_date,
    miles_of,
    _date_only,
)

router = APIRouter(prefix="/api/export", tags=["exports"])

CurrentUser = Annotated[dict, Depends(get_current_user)]


def file_response(payload: bytes, filename: str, media_type: str) -> Response:
    return Response(
        content=payload,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def _stamp(prefix: str, ext: str, year: str) -> str:
    return f"{prefix}_{year}_{datetime.now().strftime('%Y%m%d')}.{ext}"


def _mileage_deduction(trip: dict) -> float:
    explicit = float(trip.get("deduction_amount", 0) or 0)
    if explicit:
        return explicit
    return miles_of(trip) * IRS_MILEAGE_RATE


# --------------------------------------------------------------------------- #
# Chart of accounts mapping
# --------------------------------------------------------------------------- #

class CoaMapping(BaseModel):
    mapping: dict


@router.get("/coa-mapping")
async def read_coa_mapping(user: CurrentUser):
    mapping = await get_coa_mapping(user["id"])
    return {
        "mapping": mapping,
        "defaults": DEFAULT_COA,
        "categories": sorted(SCHEDULE_C_MAPPING.keys()),
        "special_accounts": {
            "mileage": MILEAGE_ACCOUNT,
            "income": INCOME_ACCOUNT,
            "clearing": CLEARING_ACCOUNT,
        },
    }


@router.put("/coa-mapping")
async def write_coa_mapping(body: CoaMapping, user: CurrentUser):
    cleaned = {
        str(k): str(v).strip()
        for k, v in body.mapping.items()
        if str(v).strip()
    }
    await db.coa_mappings.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "mapping": cleaned, "updated_at": datetime.now()}},
        upsert=True,
    )
    return {"mapping": await get_coa_mapping(user["id"])}


# --------------------------------------------------------------------------- #
# TurboTax
# --------------------------------------------------------------------------- #

@router.get("/turbotax")
async def turbotax_preview(
    user: CurrentUser,
    year: Optional[int] = None,
    scope: str = "business",
    store_id: Optional[str] = None,
):
    """On-screen summary of what the TurboTax export will contain."""
    data = await collect_data(user["id"], scope=scope, year=year, store_id=store_id)
    return {
        "export_format": "TurboTax Self-Employed Compatible",
        "tax_year": data["tax_year"],
        "generated_at": datetime.now().isoformat(),
        "summary": data["totals"],
        "schedule_c_lines": data["schedule_c_lines"],
        "income_by_source": data["income_by_source"],
        "record_counts": {
            "expenses": len(data["receipts"]),
            "mileage": len(data["mileage"]),
            "income": len(data["income"]),
        },
        "instructions": [
            "1. Download the CSV, then open TurboTax Self-Employed",
            "2. Go to Wages & Income > Self-employment income and expenses",
            "3. Enter each 1099 income source from the INCOME section",
            "4. Enter the Schedule C line totals from the SCHEDULE C SUMMARY section",
            "5. Enter total business miles from the MILEAGE section under Vehicle Expenses",
            "6. Keep this export and your receipts for 7 years",
        ],
        "disclaimer": "This export is for informational purposes. Verify all amounts with your tax professional before filing.",
    }


@router.get("/turbotax.csv")
async def turbotax_csv(
    user: CurrentUser,
    year: Optional[int] = None,
    scope: str = "business",
    store_id: Optional[str] = None,
):
    data = await collect_data(user["id"], scope=scope, year=year, store_id=store_id)
    t = data["totals"]

    summary_rows = [
        ["Tax Year", data["tax_year"]],
        ["Gross Income", f"{t['total_gross_income']:.2f}"],
        ["Total Expenses", f"{t['total_expenses']:.2f}"],
        ["Business Miles", f"{t['total_mileage_miles']:.1f}"],
        ["Mileage Deduction", f"{t['total_mileage_deduction']:.2f}"],
        ["Net Profit", f"{t['net_profit']:.2f}"],
    ]
    schedule_rows = [[line, f"{amount:.2f}"] for line, amount in sorted(data["schedule_c_lines"].items())]
    income_rows = [
        [
            _date_only(i.get("date")),
            i.get("source") or i.get("platform") or "Other",
            f"{float(i.get('amount', 0) or 0):.2f}",
            "Yes" if i.get("is_1099", True) else "No",
        ]
        for i in data["income"]
    ]
    expense_rows = [
        [
            _date_only(r.get("date")),
            r.get("vendor", ""),
            r.get("category", "Other"),
            f"{float(r.get('amount', 0) or 0):.2f}",
            SCHEDULE_C_MAPPING.get(r.get("category", "Other"), "Other expenses (Line 27a)"),
        ]
        for r in data["receipts"]
    ]
    mileage_rows = [
        [
            _date_only(m.get("date")),
            m.get("start_location", ""),
            m.get("end_location", ""),
            f"{miles_of(m):.1f}",
            m.get("purpose", "Business"),
            f"{_mileage_deduction(m):.2f}",
        ]
        for m in data["mileage"]
    ]

    payload = multi_section_csv(
        [
            ("SUMMARY", ["Item", "Value"], summary_rows),
            ("SCHEDULE C SUMMARY", ["Schedule C Line", "Amount"], schedule_rows),
            ("INCOME", ["Date", "Source", "Amount", "1099"], income_rows),
            (
                "EXPENSES",
                ["Date", "Description", "Category", "Amount", "Schedule C Line"],
                expense_rows,
            ),
            (
                "MILEAGE",
                ["Date", "From", "To", "Miles", "Purpose", "Deduction"],
                mileage_rows,
            ),
        ]
    )
    return file_response(payload, _stamp("TurboTax_Export", "csv", data["tax_year"]), "text/csv")


# --------------------------------------------------------------------------- #
# Schedule C
# --------------------------------------------------------------------------- #

@router.get("/schedule-c.csv")
async def schedule_c_csv(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    rows = [[line, f"{amount:.2f}"] for line, amount in sorted(data["schedule_c_lines"].items())]
    rows.append(["TOTAL DEDUCTIONS", f"{data['totals']['total_deductions']:.2f}"])
    rows.append(["GROSS INCOME", f"{data['totals']['total_gross_income']:.2f}"])
    rows.append(["NET PROFIT", f"{data['totals']['net_profit']:.2f}"])
    return file_response(
        csv_bytes(rows, ["Schedule C Line", "Amount"]),
        _stamp("Schedule_C", "csv", data["tax_year"]),
        "text/csv",
    )


@router.get("/schedule-c.pdf")
async def schedule_c_pdf(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    t = data["totals"]
    blocks = [
        ("heading", "Profit &amp; Loss Summary"),
        (
            "table",
            (
                ["Item", "Amount"],
                [
                    ["Gross income", money(t["total_gross_income"])],
                    ["Total expenses", money(t["total_expenses"])],
                    [f"Business miles ({t['total_mileage_miles']:,.1f} mi)", money(t["total_mileage_deduction"])],
                    ["Total deductions", money(t["total_deductions"])],
                    ["Net profit", money(t["net_profit"])],
                ],
                [320, 140],
            ),
        ),
        ("heading", "Schedule C Line Detail"),
        (
            "table",
            (
                ["Schedule C Line", "Amount"],
                [[line, money(amount)] for line, amount in sorted(data["schedule_c_lines"].items())],
                [360, 100],
            ),
        ),
        ("heading", "Expenses by Category"),
        (
            "table",
            (
                ["Category", "Amount"],
                [[cat, money(amt)] for cat, amt in sorted(data["expense_categories"].items())],
                [360, 100],
            ),
        ),
        (
            "note",
            "Prepared by TaxIQ Pro for informational purposes only. Verify all amounts with a qualified tax professional before filing.",
        ),
    ]
    pdf = build_pdf(
        "Schedule C Summary",
        f"Tax year {data['tax_year']} &nbsp;•&nbsp; {user.get('name') or user.get('email')} &nbsp;•&nbsp; generated {datetime.now().strftime('%b %d, %Y')}",
        blocks,
    )
    return file_response(pdf, _stamp("Schedule_C", "pdf", data["tax_year"]), "application/pdf")


# --------------------------------------------------------------------------- #
# IRS mileage log
# --------------------------------------------------------------------------- #

@router.get("/mileage-log.csv")
async def mileage_log_csv(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    rows = [
        [
            _date_only(m.get("date")),
            m.get("start_location", ""),
            m.get("end_location", ""),
            f"{miles_of(m):.1f}",
            m.get("purpose", "Business"),
            "Business" if m.get("is_business", True) else "Personal",
            f"{_mileage_deduction(m):.2f}",
            m.get("notes", ""),
        ]
        for m in data["mileage"]
    ]
    rows.append(
        [
            "TOTAL",
            "",
            "",
            f"{data['totals']['total_mileage_miles']:.1f}",
            "",
            "",
            f"{data['totals']['total_mileage_deduction']:.2f}",
            "",
        ]
    )
    return file_response(
        csv_bytes(
            rows,
            ["Date", "Start Location", "End Location", "Miles", "Business Purpose", "Type", "Deduction", "Notes"],
        ),
        _stamp("IRS_Mileage_Log", "csv", data["tax_year"]),
        "text/csv",
    )


@router.get("/mileage-log.pdf")
async def mileage_log_pdf(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    t = data["totals"]
    rows = [
        [
            _date_only(m.get("date")),
            (m.get("start_location", "") or "")[:28],
            (m.get("end_location", "") or "")[:28],
            f"{miles_of(m):.1f}",
            (m.get("purpose", "Business") or "")[:22],
            money(_mileage_deduction(m)),
        ]
        for m in data["mileage"]
    ]
    blocks = [
        (
            "text",
            f"Total business miles: <b>{t['total_mileage_miles']:,.1f}</b> &nbsp;•&nbsp; "
            f"Deduction at IRS standard rate: <b>{money(t['total_mileage_deduction'])}</b> &nbsp;•&nbsp; "
            f"{len(data['mileage'])} trips recorded",
        ),
        ("heading", "Trip Log"),
        ("table", (["Date", "From", "To", "Miles", "Purpose", "Deduction"], rows, [58, 130, 130, 42, 110, 60])),
        (
            "note",
            "This log records the date, starting point, destination, mileage and business purpose for each trip as required by IRS Publication 463.",
        ),
    ]
    pdf = build_pdf(
        "IRS Mileage Log",
        f"Tax year {data['tax_year']} &nbsp;•&nbsp; {user.get('name') or user.get('email')}",
        blocks,
    )
    return file_response(pdf, _stamp("IRS_Mileage_Log", "pdf", data["tax_year"]), "application/pdf")


# --------------------------------------------------------------------------- #
# Receipt summary
# --------------------------------------------------------------------------- #

@router.get("/receipt-summary.pdf")
async def receipt_summary_pdf(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    rows = [
        [
            _date_only(r.get("date")),
            (r.get("vendor", "") or "")[:34],
            (r.get("category", "Other") or "")[:24],
            "Yes" if r.get("is_deductible", True) else "No",
            money(r.get("amount")),
        ]
        for r in data["receipts"]
    ]
    blocks = [
        (
            "text",
            f"{len(data['receipts'])} receipts totalling <b>{money(data['totals']['total_expenses'])}</b>",
        ),
        ("heading", "Category Totals"),
        (
            "table",
            (
                ["Category", "Amount"],
                [[cat, money(amt)] for cat, amt in sorted(data["expense_categories"].items())],
                [360, 100],
            ),
        ),
        ("heading", "Receipt Detail"),
        ("table", (["Date", "Vendor", "Category", "Deductible", "Amount"], rows, [62, 170, 130, 60, 68])),
        (
            "note",
            "Receipt images are stored in the app and available on request. Retain records for 7 years to satisfy IRS audit requirements.",
        ),
    ]
    pdf = build_pdf(
        "Receipt Summary",
        f"Tax year {data['tax_year']} &nbsp;•&nbsp; {user.get('name') or user.get('email')}",
        blocks,
    )
    return file_response(pdf, _stamp("Receipt_Summary", "pdf", data["tax_year"]), "application/pdf")


# --------------------------------------------------------------------------- #
# CPA package
# --------------------------------------------------------------------------- #

@router.get("/cpa-package")
async def cpa_package_preview(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    return {
        "package_type": "CPA Tax Documentation Package",
        "tax_year": data["tax_year"],
        "generated_at": datetime.now().isoformat(),
        "client_summary": data["totals"],
        "income_by_source": data["income_by_source"],
        "category_totals": data["expense_categories"],
        "schedule_c_lines": data["schedule_c_lines"],
        "record_counts": {
            "receipts": len(data["receipts"]),
            "trips": len(data["mileage"]),
            "income_entries": len(data["income"]),
        },
        "notes_for_cpa": [
            "All receipts are categorized and receipt images are available on request.",
            "Mileage log includes start/end locations and business purpose for each trip.",
            "Income includes 1099 status for each source.",
            "Please verify all totals against the client's 1099 forms.",
        ],
        "disclaimer": "Prepared for tax preparation purposes. The CPA should verify all amounts.",
    }


@router.get("/cpa-package.pdf")
async def cpa_package_pdf(user: CurrentUser, year: Optional[int] = None, scope: str = "business"):
    data = await collect_data(user["id"], scope=scope, year=year)
    t = data["totals"]
    blocks = [
        ("heading", "Client Summary"),
        (
            "table",
            (
                ["Item", "Amount"],
                [
                    ["Gross income", money(t["total_gross_income"])],
                    ["Deductible expenses", money(t["total_expenses"])],
                    [f"Business miles ({t['total_mileage_miles']:,.1f} mi)", money(t["total_mileage_deduction"])],
                    ["Total deductions", money(t["total_deductions"])],
                    ["Estimated net profit", money(t["net_profit"])],
                ],
                [320, 140],
            ),
        ),
        ("heading", "Income by Source"),
        (
            "table",
            (
                ["Source", "Amount"],
                [[src, money(amt)] for src, amt in sorted(data["income_by_source"].items())],
                [360, 100],
            ),
        ),
        ("heading", "Schedule C Line Detail"),
        (
            "table",
            (
                ["Schedule C Line", "Amount"],
                [[line, money(amt)] for line, amt in sorted(data["schedule_c_lines"].items())],
                [360, 100],
            ),
        ),
        ("heading", "Expense Detail"),
        (
            "table",
            (
                ["Date", "Vendor", "Category", "Amount"],
                [
                    [
                        _date_only(r.get("date")),
                        (r.get("vendor", "") or "")[:36],
                        (r.get("category", "Other") or "")[:26],
                        money(r.get("amount")),
                    ]
                    for r in data["receipts"]
                ],
                [64, 190, 140, 76],
            ),
        ),
        ("heading", "Mileage Log"),
        (
            "table",
            (
                ["Date", "From", "To", "Miles", "Purpose"],
                [
                    [
                        _date_only(m.get("date")),
                        (m.get("start_location", "") or "")[:28],
                        (m.get("end_location", "") or "")[:28],
                        f"{miles_of(m):.1f}",
                        (m.get("purpose", "Business") or "")[:24],
                    ]
                    for m in data["mileage"]
                ],
                [62, 140, 140, 44, 84],
            ),
        ),
        (
            "note",
            "Prepared by TaxIQ Pro. The CPA should verify all totals against source documents and 1099 forms before filing.",
        ),
    ]
    pdf = build_pdf(
        "CPA Tax Package",
        f"Tax year {data['tax_year']} &nbsp;•&nbsp; {user.get('name') or user.get('email')} &nbsp;•&nbsp; generated {datetime.now().strftime('%b %d, %Y')}",
        blocks,
    )
    return file_response(pdf, _stamp("CPA_Package", "pdf", data["tax_year"]), "application/pdf")


# --------------------------------------------------------------------------- #
# Accounting software exports
# --------------------------------------------------------------------------- #

ACCOUNTING_FORMATS = {
    "quickbooks_online_csv": ("QuickBooks Online — 3-column bank import", "csv", "text/csv"),
    "quickbooks_iif": ("QuickBooks Desktop — IIF journal import", "iif", "text/plain"),
    "quickbooks_desktop_csv": ("QuickBooks Desktop — 3-column bank import", "csv", "text/csv"),
    "xero_csv": ("Xero — bank statement import", "csv", "text/csv"),
    "sage_csv": ("Sage — journal import", "csv", "text/csv"),
    "generic_journal_csv": ("Generic double-entry journal", "csv", "text/csv"),
}


@router.get("/accounting/formats")
async def accounting_formats(user: CurrentUser):
    return {
        "formats": [
            {"id": key, "label": label, "extension": ext}
            for key, (label, ext, _mime) in ACCOUNTING_FORMATS.items()
        ]
    }


def _journal_lines(data: dict, mapping: dict) -> list:
    """Balanced debit/credit lines: expense/mileage debit, clearing credit."""
    lines = []
    for r in data["receipts"]:
        amount = float(r.get("amount", 0) or 0)
        if not amount:
            continue
        lines.append(
            {
                "date": _date_only(r.get("date")),
                "account": account_for(mapping, r.get("category")),
                "name": r.get("vendor", ""),
                "memo": f"{r.get('category', 'Other')} - {r.get('vendor', '')}".strip(" -"),
                "debit": round(amount, 2),
                "credit": 0.0,
            }
        )
    for m in data["mileage"]:
        amount = round(_mileage_deduction(m), 2)
        if not amount:
            continue
        lines.append(
            {
                "date": _date_only(m.get("date")),
                "account": MILEAGE_ACCOUNT,
                "name": "",
                "memo": f"{miles_of(m):.1f} mi - {m.get('purpose', 'Business')}",
                "debit": amount,
                "credit": 0.0,
            }
        )
    for i in data["income"]:
        amount = float(i.get("amount", 0) or 0)
        if not amount:
            continue
        lines.append(
            {
                "date": _date_only(i.get("date")),
                "account": INCOME_ACCOUNT,
                "name": i.get("source") or i.get("platform") or "",
                "memo": f"Income - {i.get('source') or i.get('platform') or 'Other'}",
                "debit": 0.0,
                "credit": round(amount, 2),
            }
        )
    return lines


@router.get("/accounting")
async def accounting_export(
    user: CurrentUser,
    format: str = Query("quickbooks_online_csv"),
    year: Optional[int] = None,
    scope: str = "business",
    store_id: Optional[str] = None,
):
    if format not in ACCOUNTING_FORMATS:
        raise HTTPException(400, f"Unsupported format. Choose one of {list(ACCOUNTING_FORMATS)}")

    data = await collect_data(user["id"], scope=scope, year=year, store_id=store_id)
    mapping = await get_coa_mapping(user["id"])
    label, ext, mime = ACCOUNTING_FORMATS[format]
    year_label = data["tax_year"]

    # --- 3-column bank import (QuickBooks Online / Desktop) ---
    if format in ("quickbooks_online_csv", "quickbooks_desktop_csv"):
        rows = []
        for r in data["receipts"]:
            amount = float(r.get("amount", 0) or 0)
            if amount:
                rows.append(
                    [
                        us_date(r.get("date")),
                        f"{r.get('vendor', 'Expense')} - {r.get('category', 'Other')}",
                        f"{-amount:.2f}",
                    ]
                )
        for m in data["mileage"]:
            amount = _mileage_deduction(m)
            if amount:
                rows.append(
                    [
                        us_date(m.get("date")),
                        f"Mileage reimbursement {miles_of(m):.1f} mi - {m.get('purpose', 'Business')}",
                        f"{-amount:.2f}",
                    ]
                )
        for i in data["income"]:
            amount = float(i.get("amount", 0) or 0)
            if amount:
                rows.append(
                    [
                        us_date(i.get("date")),
                        f"Income - {i.get('source') or i.get('platform') or 'Other'}",
                        f"{amount:.2f}",
                    ]
                )
        payload = csv_bytes(rows, ["Date", "Description", "Amount"], bom=False)

    # --- QuickBooks Desktop IIF general journal ---
    elif format == "quickbooks_iif":
        lines = [
            "!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
            "!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
            "!ENDTRNS",
        ]
        for entry in _journal_lines(data, mapping):
            date = us_date(entry["date"])
            amount = entry["debit"] - entry["credit"]
            offset = CLEARING_ACCOUNT if amount > 0 else "Undeposited Funds"
            lines.append(
                f"TRNS\tGENERAL JOURNAL\t{date}\t{entry['account']}\t{entry['name']}\t{amount:.2f}\t{entry['memo']}"
            )
            lines.append(
                f"SPL\tGENERAL JOURNAL\t{date}\t{offset}\t{entry['name']}\t{-amount:.2f}\t{entry['memo']}"
            )
            lines.append("ENDTRNS")
        payload = tsv_bytes(lines)

    # --- Xero bank statement import ---
    elif format == "xero_csv":
        rows = []
        for r in data["receipts"]:
            amount = float(r.get("amount", 0) or 0)
            if amount:
                rows.append(
                    [
                        us_date(r.get("date")),
                        f"{-amount:.2f}",
                        r.get("vendor", "Expense"),
                        r.get("category", "Other"),
                        account_for(mapping, r.get("category")),
                    ]
                )
        for m in data["mileage"]:
            amount = _mileage_deduction(m)
            if amount:
                rows.append(
                    [
                        us_date(m.get("date")),
                        f"{-amount:.2f}",
                        "Mileage reimbursement",
                        f"{miles_of(m):.1f} mi {m.get('purpose', 'Business')}",
                        MILEAGE_ACCOUNT,
                    ]
                )
        for i in data["income"]:
            amount = float(i.get("amount", 0) or 0)
            if amount:
                rows.append(
                    [
                        us_date(i.get("date")),
                        f"{amount:.2f}",
                        i.get("source") or i.get("platform") or "Income",
                        "Gig income",
                        INCOME_ACCOUNT,
                    ]
                )
        payload = csv_bytes(
            rows, ["Date", "Amount", "Payee", "Description", "Account Code"], bom=False
        )

    # --- Sage / generic double-entry journal ---
    else:
        rows = []
        for entry in _journal_lines(data, mapping):
            offset = CLEARING_ACCOUNT if entry["debit"] else "Undeposited Funds"
            rows.append(
                [
                    us_date(entry["date"]),
                    entry["account"],
                    entry["memo"],
                    f"{entry['debit']:.2f}" if entry["debit"] else "",
                    f"{entry['credit']:.2f}" if entry["credit"] else "",
                ]
            )
            rows.append(
                [
                    us_date(entry["date"]),
                    offset,
                    entry["memo"],
                    f"{entry['credit']:.2f}" if entry["credit"] else "",
                    f"{entry['debit']:.2f}" if entry["debit"] else "",
                ]
            )
        payload = csv_bytes(
            rows, ["Date", "Account", "Description", "Debit", "Credit"], bom=False
        )

    prefix = format.replace("_csv", "").replace("_", "-").title().replace(" ", "")
    return file_response(payload, _stamp(prefix, ext, year_label), mime)
