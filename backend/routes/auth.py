"""Authentication routes: register, login, me, profile update."""
from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from core.database import db
from core.security import (
    ensure_indexes,
    get_current_user,
    hash_password,
    make_access_token,
    public_user,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    gig_types: list[str] = []
    profession: Optional[str] = None
    invite_code: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    profession: Optional[str] = None
    gig_types: Optional[list[str]] = None
    onboarded: Optional[bool] = None


def _norm(email: str) -> str:
    return email.strip().lower()


@router.post("/register", status_code=201)
async def register(body: RegisterIn):
    await ensure_indexes()
    email = _norm(str(body.email))

    role = "individual"
    organization_id = None
    store_id = None

    if body.invite_code:
        invite = await db.invites.find_one(
            {"code": body.invite_code.strip().upper(), "used": {"$ne": True}}
        )
        if not invite:
            raise HTTPException(400, "Invalid or already used invite code")
        role = invite["role"]
        organization_id = invite["organization_id"]
        store_id = invite.get("store_id")

    doc = {
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": role,
        "organization_id": organization_id,
        "store_id": store_id,
        "gig_types": body.gig_types,
        "profession": body.profession,
        "onboarded": False,
        "subscription_tier": "free",
        "disabled": False,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Email already registered")

    doc["_id"] = result.inserted_id

    if body.invite_code:
        await db.invites.update_one(
            {"code": body.invite_code.strip().upper()},
            {
                "$set": {
                    "used": True,
                    "used_by": str(result.inserted_id),
                    "used_at": datetime.now(timezone.utc),
                }
            },
        )

    return {
        "access_token": make_access_token(doc),
        "token_type": "bearer",
        "user": public_user(doc),
    }


@router.post("/login")
async def login(body: LoginIn):
    await ensure_indexes()
    email = _norm(str(body.email))
    user = await db.users.find_one({"email": email, "disabled": {"$ne": True}})
    if not verify_password(body.password, user.get("password_hash") if user else None):
        raise HTTPException(401, "Incorrect email or password")
    return {
        "access_token": make_access_token(user),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.get("/me")
async def me(user: Annotated[dict, Depends(get_current_user)]):
    return user


@router.patch("/me")
async def update_me(
    body: ProfileUpdate, user: Annotated[dict, Depends(get_current_user)]
):
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if updates:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": updates})
    fresh = await db.users.find_one({"_id": ObjectId(user["id"])})
    return public_user(fresh)
