import enum
from datetime import datetime
from typing import ClassVar

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.backend.models.db.base import Base


class RoleEnum(enum.Enum):
    ADMIN = "admin"
    USER = "user"


class UserAccount(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement="auto")
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    role: Mapped[Enum] = mapped_column(
        Enum(RoleEnum, name="role_enum", native_enum=False), nullable=False, default=RoleEnum.USER
    )

    hashed_password: Mapped[str | None] = mapped_column(String(1024), nullable=False)

    is_email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=func.now())

    __mapper_args__: ClassVar[dict] = {"eager_defaults": True}
