from datetime import datetime

from pydantic import BaseModel, EmailStr, constr

from app.backend.db.models import RoleEnum
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

    # Secure password rules:
    # - Minimum 12 characters
    # - Maximum 128 characters (DoS protection)
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
# UPDATE PASSWORD REQUEST BY ADMIN
# ------------------------------
class AdminPasswordChange(BaseModel):
    new_password: constr(min_length=12, max_length=128)


# ------------------------------
# RESPONSE MODEL (SAFE) - email and role removed
# ------------------------------
class UserInResponse(BaseSchemaModel):
    id: int
    username: str
    role: RoleEnum
    created_at: datetime
    is_verified: bool
    team_name: str | None = None
    team_id: int | None = None
