import enum
from datetime import datetime
from typing import ClassVar

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.backend.db.base import Base


class RoleEnum(enum.Enum):
    ADMIN = "admin"
    USER = "user"


class StatusEnum(enum.Enum):
    SUSPENDED = "suspended"
    ACTIVE = "active"


class UserTable(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    role: Mapped[RoleEnum] = mapped_column(
        Enum(RoleEnum, name="role_enum", native_enum=False),
        nullable=False,
        default=RoleEnum.USER,
    )

    hashed_password: Mapped[str] = mapped_column(String(1024), nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    status: Mapped[StatusEnum] = mapped_column(
        Enum(StatusEnum, name="role_enum", native_enum=False),
        nullable=False,
        default=StatusEnum.ACTIVE,
    )

    # mfa
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(128), default=None, nullable=True)

    # relationships
    team_associations: Mapped[list["UserInTeamTable"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    challenge_associations: Mapped[list["UserCompletedChallengeTable"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    # associations with tables
    teams: AssociationProxy[list["TeamTable"]] = association_proxy("team_associations", "team")
    completed_challenges: AssociationProxy[list["ChallengeTable"]] = association_proxy(
        "challenge_associations", "challenge"
    )

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}


class ContactMessageTable(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(128), nullable=False)
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}


class DifficultyEnum(enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ChallengeTable(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    path: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(String(512))
    hint: Mapped[str] = mapped_column(String(512))

    # is the challenge just download
    # or do we want to deploy it
    is_download: Mapped[bool] = mapped_column(Boolean, nullable=False)

    difficulty: Mapped[DifficultyEnum] = mapped_column(
        Enum(DifficultyEnum, name="difficulty_enum", native_enum=False),
        nullable=False,
    )

    points: Mapped[int] = mapped_column(Integer, nullable=False)

    # optional stored flag (if provided, used for validation)
    flag: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)

    # per-challenge CTF state
    ctf_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ctf_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    ctf_started_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    ctf_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    completion_associations: Mapped[list["UserCompletedChallengeTable"]] = relationship(
        back_populates="challenge", cascade="all, delete-orphan"
    )
    completed_by_users: AssociationProxy[list["UserTable"]] = association_proxy("completion_associations", "user")

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}


class UserCompletedChallengeTable(Base):
    __tablename__ = "user_completed_challenges"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id", ondelete="CASCADE"))

    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["UserTable"] = relationship(back_populates="challenge_associations")
    challenge: Mapped["ChallengeTable"] = relationship(back_populates="completion_associations")

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}


class TeamTable(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    # captain of the team
    captain_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # hashed team password
    team_password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    join_code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True)

    # invite token stored raw (secure random string)
    invite_token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user_associations: Mapped[list["UserInTeamTable"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
    )

    users: AssociationProxy[list["UserTable"]] = association_proxy("user_associations", "user")

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}


class UserInTeamTable(Base):
    __tablename__ = "user_teams"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))

    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["UserTable"] = relationship(back_populates="team_associations")
    team: Mapped["TeamTable"] = relationship(back_populates="user_associations")

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}


class RefreshTokenTable(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    family_id: Mapped[str] = mapped_column(String(64), index=True)

    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    replaced_by: Mapped[int | None] = mapped_column(ForeignKey("refresh_tokens.id"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
