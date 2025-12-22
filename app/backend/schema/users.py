from datetime import datetime

from pydantic import BaseModel, EmailStr, constr, field_validator

from app.backend.db.models import RoleEnum, StatusEnum
from app.backend.schema.base import BaseSchemaModel


# ------------------------------
# CREATE USER (REGISTRATION)
# ------------------------------
class UserInCreate(BaseSchemaModel):
    username: constr(
        min_length=3,
        max_length=32,
        pattern=r"^[a-zA-Z0-9_.-]+$",  # FIXED: regex - pattern
    )

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip()

    # Secure password rules:
    # - Minimum 12 characters
    # - Maximum 128 characters (DoS protection)
    password: constr(min_length=12, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class UserStatusUpdate(BaseModel):
    status: StatusEnum
    password: constr(min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str
    password: constr(min_length=12, max_length=128)


# ------------------------------
# UPDATE USER
# ------------------------------
class UserInUpdate(BaseSchemaModel):
    username: (
        constr(
            min_length=3,
            max_length=32,
            pattern=r"^[a-zA-Z0-9_.-]+$",  # FIXED
        )
        | None
    ) = None

    email: EmailStr | None = None

    password: constr(min_length=12, max_length=128) | None = None


# ------------------------------
# LOGIN REQUEST
# ------------------------------
class UserInLogin(BaseSchemaModel):
    email: EmailStr
    password: str  # Raw password, validated at login only


# ------------------------------
# RESPONSE MODEL (SAFE) - email and role removed
# ------------------------------
class UserInResponse(BaseSchemaModel):
    id: int
    username: str
    role: RoleEnum
    status: StatusEnum
    created_at: datetime
    is_verified: bool
    team_name: str | None = None
    team_id: int | None = None
