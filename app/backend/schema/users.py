import datetime

import pydantic

from app.backend.schema.base import BaseSchemaModel


class UserInCreate(BaseSchemaModel):
    username: str
    email: pydantic.EmailStr
    password: str


class UserInUpdate(BaseSchemaModel):
    username: str | None
    email: str | None
    password: str | None


class UserInLogin(BaseSchemaModel):
    email: pydantic.EmailStr
    password: str


class UserInResponse(BaseSchemaModel):
    id: int
    username: str
    email: pydantic.EmailStr
    is_verified: bool
    created_at: datetime.datetime
    role: str
