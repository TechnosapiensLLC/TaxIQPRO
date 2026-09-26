"""Authentication, JWT issuance/verification and role/tenant guards."""
import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal, Optional

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from core.database import db

load_dotenv()

ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.getenv("JWT_ISSUER", "taxiq-api")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "taxiq-app")
ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "10080"))

Role = Literal[
    "individual",
    "chain_owner",
    "store_owner",
    "store_manager",
    "driver_employee",
]

ALL_ROLES = (
    "individual",
    "chain_owner",
    "store_owner",
    "store_manager",
    "driver_employee",
)

# Roles allowed to see aggregated *business* data for a store / chain.
MANAGER_ROLES = ("chain_owner", "store_owner", "store_manager")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

# Fixed hash used to equalise login timing when an email does not exist.
DUMMY_HASH = pwd_context.hash("timing-equaliser-not-a-real-password")

_INDEXES_READY = False


async def ensure_indexes():
    global _INDEXES_READY
    if _INDEXES_READY:
        return
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("organization_id", 1), ("store_id", 1)])
    await db.service_tokens.create_index("public_id", unique=True)
    await db.stores.create_index([("organization_id", 1)])
    for coll in ("receipts", "mileage", "income", "trips"):
        await db[coll].create_index([("user_id", 1), ("date", -1)])
        await db[coll].create_index([("organization_id", 1), ("store_id", 1)])
    _INDEXES_READY = True


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: Optional[str]) -> bool:
    if not hashed:
        pwd_context.verify(raw, DUMMY_HASH)
        return False
    try:
        return pwd_context.verify(raw, hashed)
    except ValueError:
        return False


def unauthorized(detail: str = "Invalid or expired credentials") -> HTTPException:
    return HTTPException(
        status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def make_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user["_id"]),
            "email": user["email"],
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "iat": now,
            "exp": now + timedelta(minutes=ACCESS_MINUTES),
            "jti": str(uuid.uuid4()),
            "kind": "user",
        },
        JWT_SECRET,
        algorithm=ALGORITHM,
    )


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "individual"),
        "organization_id": user.get("organization_id"),
        "store_id": user.get("store_id"),
        "gig_types": user.get("gig_types", []),
        "profession": user.get("profession"),
        "onboarded": user.get("onboarded", False),
        "subscription_tier": user.get("subscription_tier", "free"),
    }


async def _resolve_user_token(token: str) -> dict:
    try:
        claims = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["sub", "exp", "iat", "iss", "aud", "jti"]},
        )
    except jwt.PyJWTError:
        raise unauthorized()
    if claims.get("kind") != "user":
        raise unauthorized()
    try:
        oid = ObjectId(claims["sub"])
    except Exception:
        raise unauthorized()
    user = await db.users.find_one({"_id": oid, "disabled": {"$ne": True}})
    if not user:
        raise unauthorized()
    ctx = public_user(user)
    ctx["auth_type"] = "user"
    ctx["scopes"] = ["*"]
    return ctx


async def _resolve_service_token(raw: str) -> dict:
    """Server-to-server token used by the external C-Store BOS backend.

    Format: ``svc_<public>.<secret>``. Only SHA-256(secret) is stored.
    An optional ``X-On-Behalf-Of-User`` header maps an external user id to a
    TaxIQ user inside the same organization.
    """
    try:
        public_id, secret = raw.split(".", 1)
    except ValueError:
        raise unauthorized()
    row = await db.service_tokens.find_one(
        {"public_id": public_id, "revoked": {"$ne": True}}
    )
    if not row:
        raise unauthorized()
    presented = hashlib.sha256(secret.encode()).hexdigest()
    if not hmac.compare_digest(presented, row["token_hash"]):
        raise unauthorized()
    return {
        "id": row["public_id"],
        "email": None,
        "name": row.get("service_name", "service"),
        "role": "service",
        "organization_id": row.get("organization_id"),
        "store_id": row.get("store_id"),
        "scopes": row.get("scopes", []),
        "auth_type": "service",
    }


async def create_service_token(
    service_name: str,
    organization_id: str,
    scopes: list,
    store_id: Optional[str] = None,
) -> str:
    public_id = "svc_" + secrets.token_urlsafe(8)
    secret = secrets.token_urlsafe(32)
    await db.service_tokens.insert_one(
        {
            "public_id": public_id,
            "service_name": service_name,
            "token_hash": hashlib.sha256(secret.encode()).hexdigest(),
            "organization_id": organization_id,
            "store_id": store_id,
            "scopes": scopes,
            "revoked": False,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return f"{public_id}.{secret}"


async def get_current_principal(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
    on_behalf_of: Optional[str] = None,
) -> dict:
    if not credentials:
        raise unauthorized("Not authenticated")
    raw = credentials.credentials
    if raw.count(".") == 2 and not raw.startswith("svc_"):
        return await _resolve_user_token(raw)
    return await _resolve_service_token(raw)


async def get_current_user(
    principal: Annotated[dict, Depends(get_current_principal)],
) -> dict:
    """A concrete TaxIQ user. Service tokens must use on-behalf-of mapping."""
    if principal.get("auth_type") == "service":
        raise HTTPException(403, "This route requires a user token")
    return principal


def require_roles(*allowed: str):
    async def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(403, "Insufficient role")
        return user

    return dependency


def owner_filter(user: dict) -> dict:
    """Records owned by this user (personal + business)."""
    return {"user_id": user["id"]}


async def store_scope_filter(user: dict, store_id: Optional[str] = None) -> dict:
    """Business-only records visible to a manager/owner.

    Personal records (``is_business`` false) are never returned so employee
    privacy is preserved.
    """
    if user.get("role") not in MANAGER_ROLES:
        raise HTTPException(403, "Insufficient role")
    org = user.get("organization_id")
    if not org:
        raise HTTPException(400, "User is not attached to an organization")
    flt: dict = {"organization_id": org, "is_business": True}
    if user["role"] == "store_manager":
        flt["store_id"] = user.get("store_id")
    elif store_id:
        flt["store_id"] = store_id
    return flt
