from app.backend.db.models import StatusEnum
from pydantic import BaseModel


class AdminDeleteConfirm(BaseModel):
    password: str


class AdminStatusChangeConfirm(BaseModel):
    password: str
    status: StatusEnum
