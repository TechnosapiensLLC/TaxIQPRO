"""QuickBooks Online OAuth 2.0 connection and transaction sync."""
import os
import secrets
from datetime import datetime, timezone
from typing import Annotated, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user

from .export_utils import (
    CLEARING_ACCOUNT,
    account_for,
    collect_data,
    get_coa_mapping,
    miles_of,
    _date_only,
)
from .exports import _mileage_deduction

router = APIRouter(prefix="/api/qbo", tags=["quickbooks"])

CurrentUser = Annotated[dict, Depends(get_current_user)]

AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
SCOPE = "com.intuit.quickbooks.accounting"


def _cfg():
    client_id = os.getenv("INTUIT_CLIENT_ID", "").strip()
    client_secret = os.getenv("INTUIT_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise HTTPException(
            503,
            "QuickBooks Online is not configured. Add INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET to the backend environment.",
        )
    return client_id, client_secret


def _base_url() -> str:
    env = os.getenv("QBO_ENV", "sandbox")
    return (
        "https://sandbox-quickbooks.api.intuit.com/v3"
        if env == "sandbox"
        else "https://quickbooks.api.intuit.com/v3"
    )


@router.get("/status")
async def qbo_status(user: CurrentUser):
    configured = bool(
        os.getenv("INTUIT_CLIENT_ID", "").strip()
        and os.getenv("INTUIT_CLIENT_SECRET", "").strip()
    )
    token = await db.qbo_tokens.find_one({"user_id": user["id"]})
    return {
        "configured": configured,
        "connected": bool(token),
        "environment": os.getenv("QBO_ENV", "sandbox"),
        "realm_id": token.get("realm_id") if token else None,
        "connected_at": token.get("connected_at").isoformat()
        if token and token.get("connected_at")
        else None,
    }


@router.get("/authorize")
async def authorize(user: CurrentUser, platform: str = Query("web")):
    client_id, _ = _cfg()
    state = secrets.token_urlsafe(32)
    await db.qbo_states.insert_one(
        {
            "_id": state,
            "user_id": user["id"],
            "platform": platform,
            "created_at": datetime.now(timezone.utc),
        }
    )
    query = urlencode(
        {
            "client_id": client_id,
            "response_type": "code",
            "scope": SCOPE,
            "redirect_uri": os.environ["INTUIT_REDIRECT_URI"],
            "state": state,
        }
    )
    return {"url": f"{AUTH_URL}?{query}"}


@router.get("/callback")
async def callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    realmId: Optional[str] = None,
    error: Optional[str] = None,
):
    stored = await db.qbo_states.find_one_and_delete({"_id": state}) if state else None
    platform = (stored or {}).get("platform", "web")
    app_redirect = (
        os.environ["APP_NATIVE_REDIRECT_URI"]
        if platform == "native"
        else os.environ["APP_WEB_REDIRECT_URI"]
    )
    if error:
        return RedirectResponse(f"{app_redirect}?qbo=denied")
    if not stored or not code or not realmId:
        raise HTTPException(400, "Invalid QuickBooks OAuth callback")

    client_id, client_secret = _cfg()
    async with httpx.AsyncClient(timeout=25) as http:
        resp = await http.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": os.environ["INTUIT_REDIRECT_URI"],
            },
            auth=(client_id, client_secret),
            headers={"Accept": "application/json"},
        )
    if resp.is_error:
        return RedirectResponse(f"{app_redirect}?qbo=error")
    token = resp.json()
    await db.qbo_tokens.update_one(
        {"user_id": stored["user_id"]},
        {
            "$set": {
                "user_id": stored["user_id"],
                "realm_id": realmId,
                "environment": os.getenv("QBO_ENV", "sandbox"),
                "access_token": token["access_token"],
                "refresh_token": token["refresh_token"],
                "access_expires": datetime.now(timezone.utc).timestamp()
                + token["expires_in"],
                "connected_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    return RedirectResponse(f"{app_redirect}?qbo=connected")


@router.delete("/disconnect")
async def disconnect(user: CurrentUser):
    await db.qbo_tokens.delete_one({"user_id": user["id"]})
    return {"connected": False}


async def _access(user_id: str) -> dict:
    doc = await db.qbo_tokens.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(409, "QuickBooks is not connected")
    if doc.get("access_expires", 0) < datetime.now(timezone.utc).timestamp() + 60:
        client_id, client_secret = _cfg()
        async with httpx.AsyncClient(timeout=25) as http:
            resp = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": doc["refresh_token"],
                },
                auth=(client_id, client_secret),
                headers={"Accept": "application/json"},
            )
        if resp.is_error:
            raise HTTPException(401, "QuickBooks connection expired. Please reconnect.")
        token = resp.json()
        await db.qbo_tokens.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "access_token": token["access_token"],
                    "refresh_token": token["refresh_token"],
                    "access_expires": datetime.now(timezone.utc).timestamp()
                    + token["expires_in"],
                }
            },
        )
        doc.update(token)
    return doc


async def _qbo_call(user_id: str, method: str, entity: str, payload=None, query=None, request_id=None):
    doc = await _access(user_id)
    params = {
        "minorversion": os.getenv("QBO_MINORVERSION", "75"),
        "requestid": request_id or secrets.token_hex(16),
    }
    if query:
        params["query"] = query
    async with httpx.AsyncClient(timeout=40) as http:
        resp = await http.request(
            method,
            f"{_base_url()}/company/{doc['realm_id']}/{entity}",
            params=params,
            json=payload,
            headers={
                "Authorization": f"Bearer {doc['access_token']}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
    if resp.status_code == 429:
        raise HTTPException(503, "QuickBooks throttled the request. Try again shortly.")
    if resp.is_error:
        raise HTTPException(resp.status_code, resp.text[:1500])
    return resp.json()


@router.get("/accounts")
async def list_accounts(user: CurrentUser, account_type: Optional[str] = None):
    query = "select Id, Name, AccountType, AccountSubType from Account where Active = true"
    if account_type:
        query += f" and AccountType = '{account_type}'"
    data = await _qbo_call(user["id"], "GET", "query", query=query)
    accounts = data.get("QueryResponse", {}).get("Account", [])
    return {
        "accounts": [
            {
                "id": a["Id"],
                "name": a["Name"],
                "type": a.get("AccountType"),
                "sub_type": a.get("AccountSubType"),
            }
            for a in accounts
        ]
    }


class SyncRequest(BaseModel):
    year: Optional[int] = None
    scope: str = "business"
    store_id: Optional[str] = None
    clearing_account_id: str
    expense_account_id: Optional[str] = None
    income_account_id: Optional[str] = None
    dry_run: bool = False


@router.post("/sync")
async def sync_to_quickbooks(body: SyncRequest, user: CurrentUser):
    """Post business expenses, mileage and income to QuickBooks Online.

    Each record becomes one balanced JournalEntry. A stable ``requestid`` per
    source record prevents duplicates when a request is retried.
    """
    data = await collect_data(
        user["id"], scope=body.scope, year=body.year, store_id=body.store_id
    )
    mapping = await get_coa_mapping(user["id"])

    if not body.expense_account_id:
        accounts = await list_accounts(user, account_type="Expense")
        if not accounts["accounts"]:
            raise HTTPException(400, "No expense accounts found in QuickBooks")
        expense_account_id = accounts["accounts"][0]["id"]
    else:
        expense_account_id = body.expense_account_id

    income_account_id = body.income_account_id

    planned = []
    for r in data["receipts"]:
        amount = round(float(r.get("amount", 0) or 0), 2)
        if amount <= 0:
            continue
        planned.append(
            {
                "source": "receipt",
                "source_id": str(r.get("_id")),
                "date": _date_only(r.get("date")),
                "amount": amount,
                "memo": f"{r.get('vendor', '')} - {r.get('category', 'Other')}".strip(" -"),
                "debit_account": expense_account_id,
                "debit_label": account_for(mapping, r.get("category")),
                "credit_account": body.clearing_account_id,
            }
        )
    for m in data["mileage"]:
        amount = round(_mileage_deduction(m), 2)
        if amount <= 0:
            continue
        planned.append(
            {
                "source": "mileage",
                "source_id": str(m.get("_id")),
                "date": _date_only(m.get("date")),
                "amount": amount,
                "memo": f"Mileage {miles_of(m):.1f} mi - {m.get('purpose', 'Business')}",
                "debit_account": expense_account_id,
                "debit_label": "Automobile:Mileage",
                "credit_account": body.clearing_account_id,
            }
        )
    if income_account_id:
        for i in data["income"]:
            amount = round(float(i.get("amount", 0) or 0), 2)
            if amount <= 0:
                continue
            planned.append(
                {
                    "source": "income",
                    "source_id": str(i.get("_id")),
                    "date": _date_only(i.get("date")),
                    "amount": amount,
                    "memo": f"Income - {i.get('source') or i.get('platform') or 'Other'}",
                    "debit_account": body.clearing_account_id,
                    "debit_label": CLEARING_ACCOUNT,
                    "credit_account": income_account_id,
                }
            )

    if body.dry_run:
        return {
            "dry_run": True,
            "planned_count": len(planned),
            "total_amount": round(sum(p["amount"] for p in planned), 2),
            "preview": planned[:25],
        }

    created, skipped, failed = 0, 0, []
    for entry in planned:
        existing = await db.qbo_sync_log.find_one(
            {"user_id": user["id"], "source_id": entry["source_id"]}
        )
        if existing and existing.get("qbo_id"):
            skipped += 1
            continue
        payload = {
            "TxnDate": entry["date"],
            "PrivateNote": entry["memo"],
            "Line": [
                {
                    "Amount": entry["amount"],
                    "Description": entry["memo"][:1000],
                    "DetailType": "JournalEntryLineDetail",
                    "JournalEntryLineDetail": {
                        "PostingType": "Debit",
                        "AccountRef": {"value": entry["debit_account"]},
                    },
                },
                {
                    "Amount": entry["amount"],
                    "Description": entry["memo"][:1000],
                    "DetailType": "JournalEntryLineDetail",
                    "JournalEntryLineDetail": {
                        "PostingType": "Credit",
                        "AccountRef": {"value": entry["credit_account"]},
                    },
                },
            ],
        }
        request_id = f"taxiq-{entry['source_id']}"
        try:
            result = await _qbo_call(
                user["id"], "POST", "journalentry", payload=payload, request_id=request_id
            )
        except HTTPException as exc:
            failed.append({"source_id": entry["source_id"], "error": str(exc.detail)[:300]})
            continue
        qbo_id = (result.get("JournalEntry") or {}).get("Id")
        await db.qbo_sync_log.update_one(
            {"user_id": user["id"], "source_id": entry["source_id"]},
            {
                "$set": {
                    "user_id": user["id"],
                    "source_id": entry["source_id"],
                    "source": entry["source"],
                    "qbo_id": qbo_id,
                    "amount": entry["amount"],
                    "synced_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        created += 1

    return {
        "created": created,
        "skipped_already_synced": skipped,
        "failed": failed,
        "total_planned": len(planned),
    }


@router.get("/sync-log")
async def sync_log(user: CurrentUser, limit: int = 100):
    rows = (
        await db.qbo_sync_log.find({"user_id": user["id"]})
        .sort("synced_at", -1)
        .to_list(length=limit)
    )
    return [
        {
            "source": r.get("source"),
            "source_id": r.get("source_id"),
            "qbo_id": r.get("qbo_id"),
            "amount": r.get("amount"),
            "synced_at": r["synced_at"].isoformat() if r.get("synced_at") else None,
        }
        for r in rows
    ]
