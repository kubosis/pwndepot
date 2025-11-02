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

from app.backend.api.v1.deps import CurrentAdminDep, CurrentUserOrAdminDep, UserRepositoryDep
from app.backend.models.db.users import UserAccount
from app.backend.models.schema.tokens import TokenResponse
from app.backend.models.schema.users import *
from app.backend.security.tokens import create_jwt_access_token
from app.backend.utils.exceptions import DBEntityDoesNotExist

router = fastapi.APIRouter(tags=["users"])


def _construct_user_in_response(user: UserAccount, include_password_hash: bool = False) -> UserInResponse:
    user_in_response = UserInResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        is_verified=user.is_email_verified,
        role=user.role,
        hashed_password=user.hashed_password if include_password_hash else None,
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
    return _construct_user_in_response(db_user)


# GET /api/v1/users
# access needs to be authorized and user needs to be admin
@router.get("/", response_model=list[UserInResponse], status_code=status.HTTP_200_OK)
async def get_users(
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
    include_password_hash: bool = False,
):
    db_users = await account_repo.read_accounts()
    response_users: list[UserInResponse] = []
    for u in db_users:
        response_users.append(_construct_user_in_response(u, include_password_hash))
    return response_users


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login_for_access_token(
    login_data: Annotated[OAuth2PasswordRequestForm, Depends()], account_repo: UserRepositoryDep
):
    """
    Handles user login and returns a JWT.
    """
    # 1. Get the User from DB
    # the form data by default contains username, but we want to login with mail
    db_user = await account_repo.read_account_by_email(login_data.username)

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Verify the password
    is_password_valid = account_repo.pwd_manager.verify_password(
        raw_password=login_data.password, hashed_password=db_user.hashed_password
    )

    if not is_password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
    db_user = await account_repo.read_account_by_id(user_id)
    return _construct_user_in_response(db_user)


@router.put("/update/{user_id}", response_model=UserInResponse, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: int,
    user_update: UserInUpdate,
    account_repo: UserRepositoryDep,
    current_user_or_admin: CurrentUserOrAdminDep,
):
    db_user = await account_repo.update_account_by_id(user_id, user_update)
    return _construct_user_in_response(db_user)


@router.delete("/{user_id}", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: int,
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
):
    try:
        await account_repo.delete_account_by_id(user_id)
    except DBEntityDoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User with specified id does not exist"
        ) from None
    return {"message": f"User {user_id} deleted successfully"}
