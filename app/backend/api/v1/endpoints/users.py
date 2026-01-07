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

import asyncio
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Annotated

import fastapi
from fastapi import BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.api.v1.deps import (
    CurrentAdminDep,
    CurrentUserDep,
    RequireAdminNonRecovery,
    RequireNonRecoverySession,
    TeamsRepositoryDep,
    UserRepositoryDep,
)
from app.backend.config.settings import get_settings
from app.backend.db.models import RefreshTokenTable, RoleEnum, StatusEnum, UserTable
from app.backend.db.session import get_async_session
from app.backend.schema.admin import AdminDeleteConfirm
from app.backend.schema.users import (
    ResendVerificationRequest,
    ResetPasswordRequest,
    UserInCreate,
    UserInResponse,
    UserInUpdate,
    UserStatusUpdate,
)
from app.backend.security.exceptions import (
    PasswordResetTokenExpired,
    PasswordResetTokenInvalid,
)
from app.backend.security.geo_ip import resolve_country
from app.backend.security.refresh_tokens import generate_refresh_token
from app.backend.security.security_events import SecurityEventType, emit_security_event, is_new_device
from app.backend.security.tokens import (
    EmailVerificationTokenExpired,
    EmailVerificationTokenInvalid,
    create_email_verification_token,
    create_jwt_access_token,
    create_password_reset_token,
    decode_email_verification_token,
    decode_password_reset_token,
)
from app.backend.utils.admin_mfa import (
    clear_admin_mfa,
    consume_admin_mfa,
    is_admin_mfa_valid,
)
from app.backend.utils.device_fingerprint import build_device_fingerprint
from app.backend.utils.email_validation import (
    has_mx_record,
    is_trusted_email,
)
from app.backend.utils.exceptions import DBEntityDoesNotExist
from app.backend.utils.limiter import limiter
from app.backend.utils.mail import send_reset_password_email, send_verification_email

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
        status=user.status,
        created_at=user.created_at,
        is_verified=user.is_email_verified,
        team_id=team_id,
        team_name=team_name,
        token_data=getattr(user, "token_data", None),
    )


# -----------------------------
# SECURE REGISTRATION
# -----------------------------


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create_user(
    request: Request,
    user: UserInCreate,
    account_repo: UserRepositoryDep,
    background_tasks: BackgroundTasks,
):
    email = user.email.lower()
    domain = email.split("@")[-1]

    # allowlist
    if not is_trusted_email(email):
        raise HTTPException(
            status_code=400,
            detail="Email domain is not supported(use a trusted email address like gmail.com).",
        )

    # MX (protection against fakes)
    if not has_mx_record(domain):
        raise HTTPException(
            status_code=400,
            detail="Invalid email domain",
        )

    db_user = await account_repo.create_account(user)
    if db_user is not None:
        logger.info(f"New user registered: username={db_user.username}, email={db_user.email}")
    else:
        logger.error(f"User registration failed for email={user.email}")
        raise HTTPException(status.HTTP_409_CONFLICT, "User already exists.")
    verification_token = create_email_verification_token(email)
    await asyncio.sleep(1)  # slight delay to avoid not sending email
    background_tasks.add_task(send_verification_email, email=email, token=verification_token)
    return _construct_user_in_response(db_user)


# -----------------------------
# FORGOT PASSWORD
# -----------------------------
@router.post("/forgot-password", status_code=200)
@limiter.limit("2/minute")
async def forgot_password(
    request: Request,
    payload: ResendVerificationRequest,  # use email
    account_repo: UserRepositoryDep,
    background_tasks: BackgroundTasks,
):
    email = payload.email.lower()
    user = await account_repo.read_account_by_email(email)

    # Always the same response (anti-enumeration), Admin accounts cannot use public password reset
    if user and user.role == RoleEnum.ADMIN:
        logger.warning(f"Password reset attempt for ADMIN account: {email}")
        return {"message": "If the account exists, a reset link was sent"}

    token = create_password_reset_token(email)
    background_tasks.add_task(send_reset_password_email, email, token)

    return {"message": "If the account exists, a reset link was sent"}


# -----------------------------
# RESET PASSWORD
# -----------------------------
@router.post("/reset-password", status_code=200, dependencies=[Depends(RequireNonRecoverySession)])
@limiter.limit("2/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    account_repo: UserRepositoryDep,
    async_session: AsyncSession = Depends(get_async_session),
):
    data = decode_password_reset_token(payload.token)
    email = data["sub"]

    user = await account_repo.read_account_by_email(email)
    if not user:
        raise HTTPException(404, "User not found")

    if user.role == RoleEnum.ADMIN:
        logger.warning(f"Password reset blocked for ADMIN account: {email}")
        # behave as if reset succeeded (anti-enumeration)
        return {"message": "Password reset successful"}

    # Check if new password is same as old password
    if account_repo.pwd_manager.verify_password(
        payload.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "PASSWORD_REUSE",
                "message": "New password must be different from the old password",
            },
        )

    hashed = account_repo.pwd_manager.hash_password(payload.password)

    await async_session.execute(update(UserTable).where(UserTable.id == user.id).values(hashed_password=hashed))

    # revoke all refresh tokens
    await async_session.execute(
        update(RefreshTokenTable).where(RefreshTokenTable.user_id == user.id).values(revoked=True)
    )

    await async_session.commit()

    return {"message": "Password reset successful"}


# -----------------------------
# VERIFY RESET PASSWORD
# -----------------------------
@router.get("/reset-password/verify", status_code=200)
@limiter.limit("5/minute")
async def verify_reset_password_token(
    request: Request,
    token: str,
):
    try:
        decode_password_reset_token(token)
    except PasswordResetTokenExpired:
        raise HTTPException(status_code=410, detail="Reset token expired") from None
    except PasswordResetTokenInvalid:
        raise HTTPException(status_code=400, detail="Invalid reset token") from None

    return {"valid": True}


# -----------------------------
# VERIFY EMAIL
# -----------------------------
@router.get("/verify-email")
async def verify_email(
    token: str,
    account_repo: UserRepositoryDep,
):
    try:
        payload = decode_email_verification_token(token)
    except EmailVerificationTokenExpired:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail={
                "code": "TOKEN_EXPIRED",
                "message": "Verification link has expired",
            },
        ) from None
    except EmailVerificationTokenInvalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "TOKEN_INVALID",
                "message": "Invalid verification token",
            },
        ) from None

    email = payload["sub"]

    user = await account_repo.read_account_by_email(email)
    if not user:
        raise HTTPException(404, "User not found")

    if user.is_email_verified:
        return {"message": "Email already verified"}

    await account_repo.mark_email_verified(user.id)

    return {"message": "Email verified successfully"}


# -----------------------------
# RESEND VERIFICATION EMAIL
# -----------------------------
@router.post("/resend-verification", status_code=status.HTTP_200_OK)
@limiter.limit("1/minute")
async def resend_verification_email(
    request: Request,
    payload: ResendVerificationRequest,
    account_repo: UserRepositoryDep,
    background_tasks: BackgroundTasks,
):
    # normalize
    email = payload.email.lower()

    user = await account_repo.read_account_by_email(email)
    if not user:
        # security: we don't reveal whether the email is registered
        return {"message": "If the account exists, a verification email was sent"}

    if user.is_email_verified:
        return {"message": "Email already verified"}

    token = create_email_verification_token(email)

    background_tasks.add_task(
        send_verification_email,
        email=email,
        token=token,
    )

    return {"message": "Verification email sent"}


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
    async_session: AsyncSession = Depends(get_async_session),
    admin: bool = False,
):
    # 1. Get the User from DB
    login_email = login_data.username.lower()
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

    # 2.5 Block admin on login
    if not admin and db_user.role == RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ADMIN_LOGIN_FORBIDDEN",
                "message": "Admins must use the admin panel to log in",
            },
        )

    # 3. Email verification & account status check
    if not db_user.is_email_verified:
        logger.warning(f"Login attempt with unverified email: {db_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "EMAIL_NOT_VERIFIED",
                "message": "Please verify your email address before logging in",
            },
        )

    if db_user.status != StatusEnum.ACTIVE:
        logger.warning(f"Login attempt for inactive account: {db_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCOUNT_SUSPENDED",
                "message": "Your account has been suspended",
            },
        )
    # ==================================================================
    # PATH A: MFA IS ENABLED (Intermediate Step)
    # ==================================================================
    if db_user.mfa_enabled:
        token_data = {"sub": str(db_user.id), "mfv": False}

        access_token = create_jwt_access_token(
            data=token_data,
        )

        # Return a response telling the Frontend to redirect to the MFA input page
        response = JSONResponse({"message": "MFA required", "mfa_required": True})

        # Set the Partial Cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=settings.COOKIE_HTTPONLY,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
            domain=settings.COOKIE_DOMAIN,
        )

        return response

    # ==================================================================
    # PATH B: MFA IS DISABLED (Full Login)
    # ==================================================================

    logger.info(f"User {db_user.email} logged in successfully.")

    fingerprint = build_device_fingerprint(request)

    country = resolve_country(request)

    if await is_new_device(async_session, db_user.id, fingerprint):
        await emit_security_event(
            user=db_user,
            event=SecurityEventType.LOGIN_NEW_DEVICE,
            request=request,
            extra={
                "country": country,
            },
        )

    # Create FULL Access Token
    token_data = {"sub": str(db_user.id), "mfv": True}
    access_token = create_jwt_access_token(data=token_data)

    raw_refresh, hashed_refresh, refresh_expires, family_id = generate_refresh_token()
    refresh = RefreshTokenTable(
        user_id=db_user.id, token_hash=hashed_refresh, expires_at=refresh_expires, family_id=family_id
    )

    async_session.add(refresh)
    await async_session.commit()

    # Cookie expiration
    expiry_date = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    cookie_domain = settings.COOKIE_DOMAIN

    response = JSONResponse({"message": "Login successful", "mfa_required": False})

    # ACCESS TOKEN
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

    # REFRESH TOKEN
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        expires=refresh_expires,
        path="/api/v1/users/auth/refresh",
        domain=cookie_domain,
    )

    return response


# -----------------------------
# REFRESH ACCESS TOKEN
# -----------------------------
@router.post("/auth/refresh", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def refresh_access_token(request: Request, async_session: AsyncSession = Depends(get_async_session)):
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    token_hash = sha256(raw_token.encode()).hexdigest()

    stmt = select(RefreshTokenTable).where(RefreshTokenTable.token_hash == token_hash)
    result = await async_session.execute(stmt)
    stored = result.scalar()

    if not stored:
        # token random / garbage - we don't know
        raise HTTPException(401, "Invalid refresh token")

    if stored.revoked:
        # revoke the rest of the family (safety net)
        await async_session.execute(
            update(RefreshTokenTable).where(RefreshTokenTable.family_id == stored.family_id).values(revoked=True)
        )
        await async_session.commit()
        raise HTTPException(401, "Refresh token reuse detected")

    if stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Refresh token expired")

    # ROTATION
    new_raw, new_hash, new_expires, family_id = generate_refresh_token(family_id=stored.family_id)

    new_token = RefreshTokenTable(
        user_id=stored.user_id, token_hash=new_hash, expires_at=new_expires, family_id=family_id
    )

    async_session.add(new_token)
    await async_session.flush()  # new_token.id available

    stored.revoked = True
    stored.replaced_by = new_token.id

    await async_session.commit()

    # new access token
    access_token = create_jwt_access_token({"sub": str(stored.user_id)})

    response = JSONResponse({"message": "Token refreshed"})

    expiry_date = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        expires=expiry_date,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )

    response.set_cookie(
        key="refresh_token",
        value=new_raw,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        expires=new_expires,
        path="/api/v1/users/auth/refresh",
        domain=settings.COOKIE_DOMAIN,
    )

    return response


## Suspend user account
@router.put(
    "/{user_id}/status", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RequireAdminNonRecovery)]
)
async def change_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
    async_session: AsyncSession = Depends(get_async_session),
):
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Admin cannot change their own account status",
        )

    if not payload.password or not payload.password.strip():
        raise HTTPException(
            status_code=400,
            detail="Admin password is required",
        )

    if not account_repo.pwd_manager.verify_password(
        payload.password,
        current_admin.hashed_password,
    ):
        raise HTTPException(403, "Invalid admin password")

    if current_admin.mfa_enabled:
        ok = await is_admin_mfa_valid(current_admin.id)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "MFA_REQUIRED"},
            )

    await account_repo.set_status(user_id, payload.status)

    if payload.status == StatusEnum.SUSPENDED:
        await async_session.execute(
            update(RefreshTokenTable).where(RefreshTokenTable.user_id == user_id).values(revoked=True)
        )
        await async_session.commit()

    logger.warning(f"ADMIN ACTION: {current_admin.username} set status={payload.status.value} for user_id={user_id}")

    if current_admin.mfa_enabled:
        await consume_admin_mfa(current_admin.id)


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
@router.put("/update/{user_id}", response_model=UserInResponse, dependencies=[Depends(RequireAdminNonRecovery)])
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
# DELETE USER (ADMIN)
# -----------------------------
@router.delete("/{user_id}", response_model=dict, dependencies=[Depends(RequireAdminNonRecovery)])
async def delete_user(
    user_id: int,
    payload: AdminDeleteConfirm,
    account_repo: UserRepositoryDep,
    current_admin: CurrentAdminDep,
):
    if not payload.password or not payload.password.strip():
        raise HTTPException(status_code=400, detail="Admin password is required")

    if not account_repo.pwd_manager.verify_password(
        payload.password,
        current_admin.hashed_password,
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid admin password",
        )

    if current_admin.mfa_enabled:
        ok = await is_admin_mfa_valid(current_admin.id)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "MFA_REQUIRED"},
            )

    if current_admin.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Admin cannot delete their own account",
        )

    try:
        await account_repo.delete_account_by_id(user_id)
        logger.info(f"User id={user_id} deleted by {current_admin.username}")
    except DBEntityDoesNotExist:
        logger.warning("Delete request of non-existent user")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User with specified id does not exist"
        ) from None
    if current_admin.mfa_enabled:
        await consume_admin_mfa(current_admin.id)
    return {"message": f"User {user_id} deleted successfully"}


# -----------------------------
# LOGOUT — CLEAR COOKIE
# -----------------------------
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(current_user: CurrentUserDep, async_session: AsyncSession = Depends(get_async_session)):
    stmt = update(RefreshTokenTable).where(RefreshTokenTable.user_id == current_user.id).values(revoked=True)
    await async_session.execute(stmt)
    await async_session.commit()
    await clear_admin_mfa(current_user.id)

    response = JSONResponse({"message": "Logout successful"})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/users/auth/refresh")

    logger.info(f"User {current_user.username} logged out")
    return response
