from collections.abc import AsyncGenerator, Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
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


reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/users/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


AsyncSessionDep = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


class TokenPayload(BaseModel):
    sub: int
    exp: int | None = None


async def get_current_user(session: AsyncSessionDep, token: TokenDep) -> UserTable:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        token_data = TokenPayload(**payload)

    # --- EXCEPTION HANDLING ---
    except jwt.ExpiredSignatureError:
        # 1. Token Expired error
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except (jwt.PyJWTError, ValidationError):
        # 2. Catch all other general invalid token errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials. Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = await session.get(UserTable, int(token_data.sub))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    return user


""" Dependency that injects user - checks if the user is logged in """
CurrentUserDep = Annotated[UserTable, Depends(get_current_user)]


async def get_current_superuser(current_user: CurrentUserDep):
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized access to the resource")
    return current_user


""" Dependency that injects admin (checks if the user is logged in and has admin privileges """
CurrentAdminDep = Annotated[UserTable, Depends(get_current_superuser)]


def get_repository(repo_type: type[BaseCRUDRepository]) -> Callable:
    def _get_repo(session: AsyncSessionDep):
        if repo_type.__name__ == "UserCRUDRepository":
            # PasswordManager is required for UserCRUDRepository
            from app.backend.security.password import PasswordManager

            return UserCRUDRepository(session, PasswordManager())
        return repo_type(session)

    return _get_repo


UserRepositoryDep = Annotated[BaseCRUDRepository, Depends(get_repository(repo_type=UserCRUDRepository))]
TeamsRepositoryDep = Annotated[BaseCRUDRepository, Depends(get_repository(repo_type=TeamsCRUDRepository))]
ChallengesRepositoryDep = Annotated[BaseCRUDRepository, Depends(get_repository(repo_type=ChallengesCRUDRepository))]


def get_self_or_admin(
    # FastAPI will automatically pass the path parameter 'user_id'
    user_id: int,
    current_user: CurrentUserDep,
) -> UserTable:
    """
    A dependency that checks if the current user is:
    1. The user they are trying to modify (is_self)
    2. An admin

    If neither, it raises a 403 Forbidden error.
    """
    is_self = current_user.id == user_id
    is_admin = current_user.role == RoleEnum.ADMIN

    if not is_self and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to perform this action on this user."
        )

    return current_user


CurrentUserOrAdminDep = Annotated[UserTable, Depends(get_self_or_admin)]
