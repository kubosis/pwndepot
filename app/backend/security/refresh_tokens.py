# app/backend/security/refresh_tokens.py
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from app.backend.config.settings import get_settings

settings = get_settings()


def generate_refresh_token(family_id: str | None = None) -> tuple[str, str, datetime, str]:
    """
    Returns:
    - raw_token (sent to client)
    - hashed_token (stored in DB)
    - expires_at
    - family_id
    """

    if family_id is None:
        family_id = secrets.token_hex(16)  # NEW SESSION

    raw_token = secrets.token_urlsafe(64)
    token_hash = sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=14)

    return raw_token, token_hash, expires_at, family_id
