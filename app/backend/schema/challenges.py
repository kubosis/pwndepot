from datetime import datetime

from app.backend.schema.base import BaseSchemaModel


class ChallengeInResponse(BaseSchemaModel):
    id: int
    name: str
    description: str | None = None
    hint: str | None = None
    is_download: bool
    difficulty: str
    points: int
    created_at: datetime
    category: str | None = None
    author: str | None = None


class FlagSubmission(BaseSchemaModel):
    flag: str
