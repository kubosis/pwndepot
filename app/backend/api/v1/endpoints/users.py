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

from typing import Annotated

import fastapi
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from loguru import logger

from app.backend.api.v1.deps import CurrentAdminDep, CurrentUserDep, CurrentUserOrAdminDep, UserRepositoryDep
from app.backend.db.models import RoleEnum, UserTable
from app.backend.schema.tokens import TokenResponse
from app.backend.schema.users import *
from app.backend.security.tokens import create_jwt_access_token
from app.backend.utils.exceptions import DBEntityDoesNotExist

router = fastapi.APIRouter(tags=["users"])


def _construct_user_in_response(user: UserTable) -> UserInResponse:
    user_in_response = UserInResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        is_verified=user.is_email_verified,
        role=user.role,
    )
    return user_in_response


# POST /api/v1/users/register
# unauthorized access
@router.post("/register", response_model=UserInResponse, status_code=status.HTTP_201_CREATED)
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


# GET /api/v1/users
# access needs to be authorized and user needs to be admin
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


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login_for_access_token(
    login_data: Annotated[OAuth2PasswordRequestForm, Depends()], account_repo: UserRepositoryDep, admin: bool = False
):
    """
    Handles user login and returns a JWT.
    """
    # 1. Get the User from DB
    # the form data by default contains username, but we want to login with mail
    login_mail = login_data.username
    db_user = await account_repo.read_account_by_email(login_data.username)

    if not db_user:
        logger.warning(f"Failed login attempt for email={login_mail}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if admin and db_user.role != RoleEnum.ADMIN:
        logger.warning(f"User {db_user.username} tried to login to admin panel")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not sufficient rights",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Verify the password
    is_password_valid = account_repo.pwd_manager.verify_password(
        raw_password=login_data.password, hashed_password=db_user.hashed_password
    )

    if not is_password_valid:
        logger.warning(f"Failed login attempt for email={login_mail}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info(f"User email={db_user.email} logged in successfully.")
    # 3. Create the JWT
    token_data = {"sub": str(db_user.id)}
    access_token = create_jwt_access_token(data=token_data)

    # 4. Return the token
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get("/profile/{user_id}", response_model=UserInResponse, status_code=status.HTTP_200_OK)
async def get_user_by_id(
    user_id: int,
    account_repo: UserRepositoryDep,
    current_user_or_admin: CurrentUserOrAdminDep,
):
    logger.info(f"Profile accessed for user_id={user_id} by user={current_user_or_admin.username}")
    db_user = await account_repo.read_account_by_id(user_id)
    return _construct_user_in_response(db_user)


@router.put("/update/{user_id}", response_model=UserInResponse, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: int,
    user_update: UserInUpdate,
    account_repo: UserRepositoryDep,
    current_user_or_admin: CurrentUserOrAdminDep,
):
    logger.info(
        f"User name={current_user_or_admin.username}, id={current_user_or_admin.id} "
        f"requested update of User id={user_id}"
    )
    db_user = await account_repo.update_account_by_id(user_id, user_update)
    return _construct_user_in_response(db_user)


@router.delete("/{user_id}", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: int,
    account_repo: UserRepositoryDep,
    current_admin: CurrentUserOrAdminDep,
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


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(
    current_user: CurrentUserDep,
):
    """
    Handles user logout.
    This endpoint only confirms the user is authenticated.
    The client is responsible for deleting the token.
    """
    logger.info(f"User {current_user.username} requested logout")
    return {"message": f"Logout of {current_user.username} was successful"}
