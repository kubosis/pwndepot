from datetime import datetime

from app.backend.schema.base import BaseSchemaModel


class TeamInCreate(BaseSchemaModel):
    team_name: str


class TeamInUpdate(BaseSchemaModel):
    team_name: str


class TeamInDelete(BaseSchemaModel):
    team_name: str | None = None
    team_id: int | None = None


class UserInTeam(BaseSchemaModel):
    username: str


class TeamWithUsersInResponse(BaseSchemaModel):
    team_id: int
    team_name: str
    join_code: str
    created_at: datetime
    users: list[UserInTeam]


class ScoreRecord(BaseSchemaModel):
    date_time: datetime
    obtained_by: str  # username
    score: int


class TeamWithScoresInResponse(BaseSchemaModel):
    team_id: int
    team_name: str
    scores: list[ScoreRecord]
    total_score: int


class FullTeamInResponse(BaseSchemaModel):
    # TeamWithScoresInResponse + TeamWithUsersInResponse
    team_id: int
    team_name: str
    scores: list[ScoreRecord]
    total_score: int
    join_code: str
    created_at: datetime
    users: list[UserInTeam]
