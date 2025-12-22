from datetime import datetime, timedelta, timezone

import pyotp
from fastapi import APIRouter, HTTPException, Response, status

from app.backend.api.v1.deps import AsyncSessionDep, CurrentUserDep, PartiallyLoggedInUserDep
from app.backend.config.settings import get_settings
from app.backend.db.models import RefreshTokenTable, RoleEnum
from app.backend.schema.mfa import MfaEnableRequest, MfaSetupResponse, MfaVerifyRequest
from app.backend.security.refresh_tokens import generate_refresh_token
from app.backend.security.tokens import create_jwt_access_token
from app.backend.utils.admin_mfa import mark_admin_mfa_verified

settings = get_settings()

router = APIRouter(tags=["MFA"])


@router.post("/setup", response_model=MfaSetupResponse)
async def setup_mfa(user: CurrentUserDep):
    if user.mfa_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA is already enabled.")

    # 1. Generate random secret
    secret = pyotp.random_base32()

    # 2. Generate URI for QR Code
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=settings.APP_NAME)

    return {"secret": secret, "otpauth_url": uri}


@router.post("/enable")
async def enable_mfa(payload: MfaEnableRequest, session: AsyncSessionDep, user: CurrentUserDep):
    if user.mfa_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA is already enabled.")

    # 1. Verify the code matches the secret the frontend sent back
    totp = pyotp.TOTP(payload.secret)
    if not totp.verify(payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid MFA code.")

    # 2. Save to DB
    user.mfa_secret = payload.secret
    user.mfa_enabled = True

    session.add(user)
    await session.commit()

    return {"message": "MFA enabled successfully."}


@router.post("/verify")
async def verify_mfa_login(
    payload: MfaVerifyRequest, response: Response, session: AsyncSessionDep, user: PartiallyLoggedInUserDep
):
    if not user.mfa_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA not enabled for this user.")

    # Verify the code against the DB secret
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(payload.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid MFA code.")

    # Generate FULL Access Token
    token_data = {"sub": str(user.id), "mfv": True}
    access_token = create_jwt_access_token(data=token_data)

    # Generate Refresh Token
    raw_refresh, hashed_refresh, refresh_expires, family_id = generate_refresh_token()

    refresh = RefreshTokenTable(
        user_id=user.id, token_hash=hashed_refresh, expires_at=refresh_expires, family_id=family_id
    )
    session.add(refresh)
    await session.commit()

    # Set Cookies
    cookie_domain = settings.COOKIE_DOMAIN
    expiry_date = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Set Full Access Token
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

    # Set Refresh Token
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

    return {"message": "MFA verification successful. Logged in."}


@router.post("/admin/verify")
async def verify_admin_mfa(
    payload: MfaVerifyRequest,
    user: PartiallyLoggedInUserDep,
):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403, "Admin only")

    if not user.mfa_enabled:
        raise HTTPException(400, "MFA not enabled")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(payload.code):
        raise HTTPException(401, "Invalid MFA code")

    await mark_admin_mfa_verified(user.id)
    return {"message": "Admin MFA verified"}
