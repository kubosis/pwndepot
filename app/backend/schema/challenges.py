from datetime import datetime

from app.backend.schema.base import BaseSchemaModel


class ChallengeInResponse(BaseSchemaModel):
    id: int
    name: str
    path: str
    description: str | None = None
    hint: str | None = None
    is_download: bool
    difficulty: str
    points: int
    created_at: datetime


class FlagSubmission(BaseSchemaModel):
    flag: str


class CTFStartRequest(BaseSchemaModel):
    duration_seconds: int
