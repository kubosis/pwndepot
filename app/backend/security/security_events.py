# app/backend/security/security_events.py
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import select

from app.backend.db.models import SecurityDevice


class SecurityEventType(str, Enum):
    LOGIN_NEW_DEVICE = "login_new_device"
    LOGIN_BACKUP_CODE = "login_backup_code"
    MFA_RESET = "mfa_reset"
    ADMIN_LOGIN = "admin_login"
    ADMIN_RECOVERY_LOGIN = "admin_recovery_login"


def format_security_time(dt: datetime) -> str:
    return dt.strftime("%d %b %Y • %H:%M UTC")


async def emit_security_event(
    *,
    user,
    event: SecurityEventType,
    request,
    extra: dict | None = None,
):
    from app.backend.utils.security_mailer import send_security_email

    now = datetime.utcnow()

    meta = {
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent"),
        "time": format_security_time(now),
    }

    if extra:
        meta.update(extra)

    await send_security_email(
        user=user,
        event=event,
        meta=meta,
    )


async def is_new_device(session, user_id: int, fingerprint: str) -> bool:
    stmt = select(SecurityDevice).where(
        SecurityDevice.user_id == user_id,
        SecurityDevice.fingerprint == fingerprint,
    )
    result = await session.execute(stmt)
    device = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if device:
        device.last_seen = now
        await session.commit()
        return False

    session.add(
        SecurityDevice(
            user_id=user_id,
            fingerprint=fingerprint,
            first_seen=now,
            last_seen=now,
        )
    )
    await session.commit()
    return True
