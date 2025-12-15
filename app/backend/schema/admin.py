from pydantic import BaseModel


class AdminDeleteConfirm(BaseModel):
    password: str
