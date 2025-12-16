from datetime import datetime

from pydantic import constr

from app.backend.schema.base import BaseSchemaModel


# -----------------------------
# TEAM CREATION
# -----------------------------
class TeamInCreate(BaseSchemaModel):
    team_name: constr(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    team_password: constr(min_length=8, max_length=64)


# -----------------------------
# TEAM UPDATE
# -----------------------------
class TeamInUpdate(BaseSchemaModel):
    team_name: constr(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$") | None = None


# -----------------------------
# TEAM DELETE REQUEST
# -----------------------------
class TeamInDelete(BaseSchemaModel):
    team_name: str | None = None
    team_id: int | None = None


# -----------------------------
# BASIC USER REPRESENTATION
# -----------------------------
class UserInTeam(BaseSchemaModel):
    username: str


# -----------------------------
# SCORE RECORD
# -----------------------------
class ScoreRecord(BaseSchemaModel):
    date_time: datetime
    obtained_by: str
    score: int


# -----------------------------
# TEAM WITH USERS
# -----------------------------
class TeamWithUsersInResponse(BaseSchemaModel):
    team_id: int
    team_name: str
    created_at: datetime
    users: list[UserInTeam]


# -----------------------------
# TEAM WITH SCORES
# -----------------------------
class TeamWithScoresInResponse(BaseSchemaModel):
    team_id: int
    team_name: str
    scores: list[ScoreRecord]
    total_score: int


# -----------------------------
# FULL TEAM RESPONSE
# -----------------------------
class FullTeamInResponse(BaseSchemaModel):
    team_id: int
    team_name: str
    captain_user_id: int
    scores: list[ScoreRecord]
    total_score: int
    created_at: datetime
    users: list[UserInTeam]
    invite_url: str | None = None

    class Config:
        from_attributes = True


# -----------------------------
# INVITE TOKEN RESPONSE
# -----------------------------
class TeamInviteInfo(BaseSchemaModel):
    team_id: int
    team_name: str


# -----------------------------
# REQUEST: JOIN TEAM USING INVITE
# -----------------------------
class TeamJoinViaInvite(BaseSchemaModel):
    token: str
    password: str
