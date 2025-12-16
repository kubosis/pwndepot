import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.db.models import ContactMessageTable
from app.backend.schema.contact import ContactRequest


SPAM_WINDOW_MINUTES = 5


def _hash_contact(email: str, message: str) -> str:
    return hashlib.sha256(f"{email}:{message}".encode()).hexdigest()


async def save_contact_message(db: AsyncSession, data: ContactRequest) -> bool:
    """
    Saves contact message.
    Returns False if duplicate detected.
    """

    content_hash = _hash_contact(data.email, data.message)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=SPAM_WINDOW_MINUTES)

    stmt = (
        select(ContactMessageTable)
        .where(ContactMessageTable.content_hash == content_hash)
        .where(ContactMessageTable.created_at >= cutoff)
    )

    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return False  # duplicate spam

    msg = ContactMessageTable(
        name=data.name,
        email=data.email,
        message=data.message,
        content_hash=content_hash,
    )

    db.add(msg)
    await db.commit()
    return True
