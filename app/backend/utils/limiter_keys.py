# app/backend/utils/limiter_keys.py
from __future__ import annotations

import jwt
from starlette.requests import Request

from app.backend.config.settings import get_settings

settings = get_settings()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _jwt_sub_from_cookie(request: Request) -> str | None:
    """
    Try to extract user id (sub) from access_token cookie.
    We do NOT verify exp here because we only need a stable rate-limit key.
    """
    token = request.cookies.get("access_token")
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer="PwnDepot",
            options={"verify_exp": False},
        )
        sub = payload.get("sub")
        return str(sub) if sub is not None else None
    except Exception:
        return None


# -----------------------------
# Admin key (per admin user id)
# -----------------------------
def admin_key(request: Request) -> str:
    """
    Rate-limit per authenticated admin (sub from JWT cookie), fallback to IP.
    Key format:
      admin:<user_id>:<path>
      admin:ip:<ip>:<path>
    """
    sub = _jwt_sub_from_cookie(request)
    if sub:
        return f"admin:{sub}:{request.url.path}"

    ip = client_ip(request)
    return f"admin:ip:{ip}:{request.url.path}"


# -----------------------------
# Auth keys (must be sync in SlowAPI)
# -----------------------------
def login_key(request: Request) -> str:
    """
    Rate-limit login by IP (safe + sync).
    NOTE: Do not read request.form() here - SlowAPI key_func is sync.
    """
    ip = client_ip(request)
    return f"login:ip:{ip}:{request.url.path}"


def forgot_password_key(request: Request) -> str:
    """
    Rate-limit forgot-password by IP (safe + sync).
    NOTE: Do not read request.body() here - SlowAPI key_func is sync.
    """
    ip = client_ip(request)
    return f"forgot:ip:{ip}:{request.url.path}"


def resend_verification_key(request: Request) -> str:
    """
    Rate-limit resend-verification by IP (safe + sync).
    """
    ip = client_ip(request)
    return f"resend:ip:{ip}:{request.url.path}"


def reset_password_key(request: Request) -> str:
    """
    Rate-limit reset-password by IP (safe + sync).
    """
    ip = client_ip(request)
    return f"reset:ip:{ip}:{request.url.path}"


def mfa_verify_key(request: Request) -> str:
    """
    Rate-limit MFA verify per user if possible, fallback to IP.
    """
    sub = _jwt_sub_from_cookie(request)
    if sub:
        return f"mfa:{sub}:{request.url.path}"

    ip = client_ip(request)
    return f"mfa:ip:{ip}:{request.url.path}"
