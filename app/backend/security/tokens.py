from datetime import datetime, timedelta, timezone

import jwt

from app.backend.config.settings import get_settings

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
        "iss": "ISEP CTF",
        "mfv": data.get("mfv") if "mfv" in data else ...,
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
