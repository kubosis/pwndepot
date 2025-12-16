"""
Prefix: /api/v1/users
## Authentication & User Management
- *POST /api/v1/users/register* – create a new user account (*password stored hashed + salted*)
- *POST /api/v1/users/login* – user login; returns JWT
- *POST /api/v1/users/logout* – logout user (invalidate token or clear session)
- *POST /api/v1/users/update/{user_id}* – change current user’s password / email / name
- *GET  /api/v1/users/profile/:userId* – get authenticated user’s profile including historical scores
- *GET  /api/v1/users* – list all users (admin only)
- *DELETE /api/v1/users/:id* – delete a user (admin only)
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import fastapi
from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from loguru import logger

from app.backend.api.v1.deps import (
    CurrentAdminDep,
    CurrentUserDep,
    TeamsRepositoryDep,
    UserRepositoryDep,
)
from app.backend.config.settings import get_settings
from app.backend.db.models import RoleEnum, UserTable
from app.backend.schema.users import AdminPasswordChange, UserInCreate, UserInResponse, UserInUpdate
from app.backend.security.tokens import create_jwt_access_token
from app.backend.utils.exceptions import DBEntityDoesNotExist
from app.backend.utils.limiter import limiter

router = fastapi.APIRouter(tags=["users"])
settings = get_settings()


def _construct_user_in_response(
    user: UserTable,
    *,
    team_id: int | None = None,
    team_name: str | None = None,
) -> UserInResponse:
    return UserInResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at,
        is_verified=user.is_email_verified,
        team_id=team_id,
        team_name=team_name,
    )


# -----------------------------
# SECURE REGISTRATION
# -----------------------------
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def create_user(
    user: UserInCreate,
    account_repo: UserRepositoryDep,
):
    db_user = await account_repo.create_account(user)
    if db_user is not None:
        logger.info(f"New user registered: username={db_user.username}, email={db_user.email}")
    else:
        logger.error(f"User registration failed for email={user.email}")
        raise HTTPException(status.HTTP_409_CONFLICT, "User with this email already exists.")
    return _construct_user_in_response(db_user)


# -----------------------------
# ADMIN: GET ALL USERS
# -----------------------------
@router.get("/", response_model=list[UserInResponse], status_code=status.HTTP_200_OK)
async def get_users(
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
):
    logger.info(f"Admin {current_admin.username} requested user list.")
    db_users = await account_repo.read_accounts()
    response_users: list[UserInResponse] = []
    for u in db_users:
        response_users.append(_construct_user_in_response(u))
    return response_users


# -----------------------------
# SECURE LOGIN USING HTTPONLY COOKIE
# -----------------------------
@router.post("/login", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    login_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    account_repo: UserRepositoryDep,
    admin: bool = False,
):
    # 1. Get the User from DB
    # the form data by default contains username, but we want to login with mail
    login_email = login_data.username
    db_user = await account_repo.read_account_by_email(login_email)

    if not db_user:
        logger.warning(f"Failed login attempt for email={login_email}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if admin and db_user.role != RoleEnum.ADMIN:
        logger.warning(f"Unauthorized admin login attempt by {db_user.username}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not sufficient rights")
    # 2. Verify Password
    if not account_repo.pwd_manager.verify_password(login_data.password, db_user.hashed_password):
        logger.warning(f"Failed login attempt for email={login_email}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    logger.info(f"User {db_user.email} logged in successfully.")

    # Create JWT
    token_data = {"sub": str(db_user.id)}
    access_token = create_jwt_access_token(data=token_data)

    # Cookie expiration
    expiry_date = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    cookie_domain = settings.COOKIE_DOMAIN

    response = JSONResponse({"message": "Login successful"})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        expires=expiry_date,
        path="/",
        domain=cookie_domain,
    )

    return response


# -----------------------------
# GET USER PROFILE BY USERNAME, not user ID because it's more friendly
# -----------------------------
@router.get("/profile/{username}", response_model=UserInResponse)
async def get_user_profile(
    username: str,
    account_repo: UserRepositoryDep,
    team_repo: TeamsRepositoryDep,
):
    user = await account_repo.read_account_by_username(username)
    if not user:
        raise HTTPException(404, "User not found")

    team = await team_repo.get_team_for_user(user.id)

    return _construct_user_in_response(
        user,
        team_id=team.id if team else None,
        team_name=team.name if team else None,
    )


# -----------------------------
# CURRENT AUTHENTICATED USER
# -----------------------------
@router.get("/me", response_model=UserInResponse)
async def get_me(current_user: CurrentUserDep, team_repo: TeamsRepositoryDep):
    team = await team_repo.get_team_for_user(current_user.id)

    return _construct_user_in_response(
        current_user,
        team_id=team.id if team else None,
        team_name=team.name if team else None,
    )


# -----------------------------
# UPDATE USER
# -----------------------------
@router.put("/update/{user_id}", response_model=UserInResponse)
async def update_user(
    user_id: int,
    user_update: UserInUpdate,
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
):
    if current_admin.id == user_id:
        raise HTTPException(status_code=403, detail="Admins cannot modify their own account via this endpoint")

    updated = await account_repo.update_account_by_id(user_id, user_update)

    logger.warning(f"ADMIN ACTION: {current_admin.username} updated user_id={user_id}")

    return _construct_user_in_response(updated)


# -----------------------------
# UPDATE PASSWORD (ADMIN)
# -----------------------------
@router.put("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def admin_change_user_password(
    user_id: int,
    payload: AdminPasswordChange,
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
):
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=403,
            detail="Admins cannot change their own password via this endpoint",
        )

    await account_repo.change_password_by_admin(
        user_id=user_id,
        new_password=payload.new_password,
    )

    logger.warning(f"ADMIN ACTION: {current_admin.username} changed password for user_id={user_id}")


# -----------------------------
# DELETE USER (ADMIN)
# -----------------------------
@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
):
    try:
        await account_repo.delete_account_by_id(user_id)
        logger.info(f"User id={user_id} deleted by {current_admin.username}")
    except DBEntityDoesNotExist:
        logger.warning("Delete request of non-existent user")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User with specified id does not exist"
        ) from None
    return {"message": f"User {user_id} deleted successfully"}


# -----------------------------
# LOGOUT — CLEAR COOKIE
# -----------------------------
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(current_user: CurrentUserDep):
    response = JSONResponse({"message": "Logout successful"})

    response.delete_cookie(
        key="access_token",
        path="/",
    )

    logger.info(f"User {current_user.username} logged out")
    return response
