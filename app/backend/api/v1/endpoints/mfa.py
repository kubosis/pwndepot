from datetime import datetime, timedelta, timezone

import pyotp
from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import func, select, update

from app.backend.api.v1.deps import AsyncSessionDep, CurrentUserDep, PartiallyLoggedInUserDep
from app.backend.config.redis import redis_client
from app.backend.config.settings import get_settings
from app.backend.db.models import MFABackupCodeTable, RefreshTokenTable, RoleEnum
from app.backend.schema.mfa import MfaEnableRequest, MfaSetupResponse, MfaVerifyRequest
from app.backend.security.geo_ip import resolve_country
from app.backend.security.mfa_backup_codes import generate_backup_codes
from app.backend.security.password import PasswordManager
from app.backend.security.refresh_tokens import generate_refresh_token
from app.backend.security.security_events import SecurityEventType, emit_security_event, is_new_device
from app.backend.security.tokens import create_jwt_access_token
from app.backend.utils.admin_mfa import mark_admin_mfa_verified
from app.backend.utils.device_fingerprint import build_device_fingerprint
from app.backend.utils.limiter import limiter

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

    # 3. Generate BACKUP CODES
    pwd_manager = PasswordManager()
    backup_codes = generate_backup_codes(10)

    backup_rows = [
        MFABackupCodeTable(user_id=user.id, code_hash=pwd_manager.hash_password(code)) for code in backup_codes
    ]

    session.add_all(backup_rows)
    await session.commit()

    # 4. Return backup codes ONCE
    return {"message": "MFA enabled successfully.", "backup_codes": backup_codes}


@limiter.limit("5/minute")
@router.post("/verify")
async def verify_mfa_login(
    request: Request,
    payload: MfaVerifyRequest,
    response: Response,
    session: AsyncSessionDep,
    user: PartiallyLoggedInUserDep,
):
    if not user.mfa_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MFA not enabled for this user.")

    # Verify the code against the DB secret
    pwd_manager = PasswordManager()
    recovery_login = False

    # Try TOTP first
    totp = pyotp.TOTP(user.mfa_secret)
    verified = totp.verify(payload.code, valid_window=1)

    # Backup code fallback
    if not verified:
        result = await session.execute(
            select(MFABackupCodeTable).where(
                MFABackupCodeTable.user_id == user.id, MFABackupCodeTable.used_at.is_(None)
            )
        )

        for bc in result.scalars():
            if pwd_manager.verify_password(payload.code, bc.code_hash):
                bc.used_at = func.now()
                recovery_login = True
                verified = True
                break

    if not verified:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid MFA code")

    # Generate FULL Access Token
    token_data = {"sub": str(user.id), "mfv": True, "mfa_recovery": recovery_login}
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

    country = resolve_country(request)

    if recovery_login:
        await emit_security_event(
            user=user,
            event=SecurityEventType.LOGIN_BACKUP_CODE,
            request=request,
            extra={
                "country": country,
            },
        )
    fingerprint = build_device_fingerprint(request)
    await is_new_device(session, user.id, fingerprint)
    return {"message": "MFA verification successful. Logged in."}


@limiter.limit("5/minute")
@router.post("/admin/verify")
async def verify_admin_mfa(
    request: Request,
    payload: MfaVerifyRequest,
    session: AsyncSessionDep,
    user: PartiallyLoggedInUserDep,
):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403, "Admin only")

    if not user.mfa_enabled:
        raise HTTPException(400, "MFA not enabled")

    pwd_manager = PasswordManager()
    recovery_login = False

    totp = pyotp.TOTP(user.mfa_secret)
    verified = totp.verify(payload.code, valid_window=1)

    if not verified:
        result = await session.execute(
            select(MFABackupCodeTable).where(
                MFABackupCodeTable.user_id == user.id, MFABackupCodeTable.used_at.is_(None)
            )
        )

        for bc in result.scalars():
            if pwd_manager.verify_password(payload.code, bc.code_hash):
                bc.used_at = func.now()
                recovery_login = True
                verified = True
                break

    if not verified:
        raise HTTPException(401, "Invalid MFA code")

    await mark_admin_mfa_verified(user.id)

    # mark recovery in redis
    if recovery_login:
        await redis_client.set(f"admin:mfa:recovery:{user.id}", "1", ex=300)

    return {"message": "Admin MFA verified"}


@limiter.limit("5/minute")
@router.post("/reset")
async def reset_mfa(request: Request, session: AsyncSessionDep, user: CurrentUserDep):
    if not user.mfa_enabled:
        raise HTTPException(400, "MFA not enabled")

    if not user.token_data.get("mfa_recovery"):
        raise HTTPException(403, "Recovery session required")

    user.mfa_enabled = False
    user.mfa_secret = None

    await session.execute(
        update(MFABackupCodeTable).where(MFABackupCodeTable.user_id == user.id).values(used_at=func.now())
    )

    session.add(user)
    await session.commit()

    country = resolve_country(request)

    await emit_security_event(
        user=user,
        event=SecurityEventType.MFA_RESET,
        request=request,
        extra={
            "country": country,
        },
    )

    return {"message": "MFA reset successfully"}
