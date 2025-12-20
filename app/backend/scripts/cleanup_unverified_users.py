from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.backend.db.models import RoleEnum, UserTable
from app.backend.db.session import get_async_session

UNVERIFIED_TTL_DAYS = 7


async def cleanup_unverified_users():
    cutoff = datetime.now(timezone.utc) - timedelta(days=UNVERIFIED_TTL_DAYS)

    async with get_async_session() as session:
        await session.execute(
            delete(UserTable).where(
                UserTable.email_verified_at.is_(None),
                UserTable.created_at < cutoff,
                UserTable.role != RoleEnum.ADMIN,
            )
        )
        await session.commit()
