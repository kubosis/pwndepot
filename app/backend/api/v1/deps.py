from collections.abc import AsyncGenerator, Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.config.settings import get_settings
from app.backend.db.models import RoleEnum, UserTable
from app.backend.db.session import AsyncSessionLocal
from app.backend.repository.base import BaseCRUDRepository
from app.backend.repository.challenges import ChallengesCRUDRepository
from app.backend.repository.teams import TeamsCRUDRepository
from app.backend.repository.users import UserCRUDRepository

settings = get_settings()


# -----------------------------
# DATABASE SESSION
# -----------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


AsyncSessionDep = Annotated[AsyncSession, Depends(get_db)]


# -----------------------------
# JWT PAYLOAD
# -----------------------------
class TokenPayload(BaseModel):
    sub: int
    exp: int
    iat: int | None = None
    nbf: int | None = None
    iss: str | None = None
    type: str | None = None


# -----------------------------
# CURRENT USER FROM COOKIE
# -----------------------------
async def get_current_user(
    request: Request,
    session: AsyncSessionDep,
) -> UserTable:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        token_data = TokenPayload(**payload)

    except jwt.ExpiredSignatureError as err:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired.") from err

    except (jwt.PyJWTError, ValidationError) as err:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token.") from err

    user = await session.get(UserTable, int(token_data.sub))

    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists.")

    return user


CurrentUserDep = Annotated[UserTable, Depends(get_current_user)]


# -----------------------------
# ADMIN ONLY
# -----------------------------
async def get_current_admin(current_user: CurrentUserDep) -> UserTable:
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin privileges required.")
    return current_user


CurrentAdminDep = Annotated[UserTable, Depends(get_current_admin)]


# -----------------------------
# SELF OR ADMIN
# -----------------------------
async def get_self_or_admin(
    user_id: int,
    current_user: CurrentUserDep,
    session: AsyncSessionDep,
) -> UserTable:
    target = await session.get(UserTable, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

    if current_user.id != user_id and current_user.role != RoleEnum.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")

    return current_user


CurrentUserOrAdminDep = Annotated[UserTable, Depends(get_self_or_admin)]


# -----------------------------
# REPOSITORY FACTORY
# -----------------------------
def get_repository(repo_type: type[BaseCRUDRepository]) -> Callable:
    def _get_repo(session: AsyncSessionDep):
        from app.backend.security.password import PasswordManager

        if repo_type is UserCRUDRepository:
            return UserCRUDRepository(session, PasswordManager())

        return repo_type(session)

    return _get_repo


# -----------------------------
# CORRECT REPOSITORY DEPENDENCIES
# -----------------------------
UserRepositoryDep = Annotated[UserCRUDRepository, Depends(get_repository(UserCRUDRepository))]

TeamsRepositoryDep = Annotated[TeamsCRUDRepository, Depends(get_repository(TeamsCRUDRepository))]

ChallengesRepositoryDep = Annotated[ChallengesCRUDRepository, Depends(get_repository(ChallengesCRUDRepository))]
