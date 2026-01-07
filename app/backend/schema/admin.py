from pydantic import BaseModel

from app.backend.db.models import StatusEnum


class AdminDeleteConfirm(BaseModel):
    password: str


class AdminStatusChangeConfirm(BaseModel):
    password: str
    status: StatusEnum
