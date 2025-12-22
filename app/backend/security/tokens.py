from datetime import datetime, timedelta, timezone

import jwt
from jwt import ExpiredSignatureError, PyJWTError

from app.backend.config.settings import get_settings
from app.backend.security.exceptions import (
    EmailVerificationTokenExpired,
    EmailVerificationTokenInvalid,
    PasswordResetTokenExpired,
    PasswordResetTokenInvalid,
)

settings = get_settings()


# ---------------------------------------------------------
# ACCESS TOKEN
# ---------------------------------------------------------
def create_jwt_access_token(data: dict) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": data.get("sub"),
        "type": "access",
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iss": "PwnDepot",
        "mfv": data.get("mfv", False),
    }

    encoded_jwt = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


# ---------------------------------------------------------
# TEAM INVITE TOKEN
# ---------------------------------------------------------
def create_team_invite_token(team_id: int, join_code: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "team_id": team_id,
        "join_code": join_code,
        "type": "team_invite",
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(days=7),  # invite link valid 7 days
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_team_invite_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


## Email Verification Token
def create_email_verification_token(email: str):
    expire = datetime.now(timezone.utc) + timedelta(hours=24)  # valid for 24 hours

    payload = {
        "sub": email,
        "type": "email_verification",
        "iat": datetime.now(timezone.utc),
        "nbf": datetime.now(timezone.utc),
        "iss": "PwnDepot",
        "exp": expire,
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


## Email Verification Token Decoding
def decode_email_verification_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer="PwnDepot",
        )
    except ExpiredSignatureError:
        raise EmailVerificationTokenExpired("Verification link has expired") from None
    except PyJWTError:
        raise EmailVerificationTokenInvalid("Invalid verification token") from None

    if payload.get("type") != "email_verification":
        raise EmailVerificationTokenInvalid("Invalid token type")

    return payload


# RESET PASSWORD TOKEN
def create_password_reset_token(email: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": email,
        "type": "password_reset",
        "iat": now,
        "nbf": now,
        "iss": "PwnDepot",
        "exp": now + timedelta(hours=1),  # 1h
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_password_reset_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer="PwnDepot",
        )
    except ExpiredSignatureError:
        raise PasswordResetTokenExpired("Reset link has expired") from None
    except PyJWTError:
        raise PasswordResetTokenInvalid("Invalid reset token") from None

    if payload.get("type") != "password_reset":
        raise PasswordResetTokenInvalid("Invalid token type")

    return payload
