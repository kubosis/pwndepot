from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.db.models import CTFStateTable
from app.backend.repository.base import BaseCRUDRepository


class CTFStateRepository(BaseCRUDRepository):
    def __init__(self, async_session: AsyncSession):
        super().__init__(async_session)

    async def get_state(self) -> CTFStateTable:
        """
        Return the single global CTF state row (id=1).
        If it doesn't exist yet, create it with active=True.
        """
        row = await self.async_session.get(CTFStateTable, 1)
        if row:
            return row

        row = CTFStateTable()
        row.id = 1
        row.active = False
        row.ends_at = None
        row.paused_remaining_seconds = None
        row.started_by_user_id = None
        row.started_at = None
        self.async_session.add(row)
        await self.async_session.commit()
        await self.async_session.refresh(row)
        return row

    async def set_state(
        self,
        *,
        active: bool,
        ends_at: datetime | None,
        started_by_user_id: int | None,
        started_at: datetime | None,
    ) -> CTFStateTable:
        """
        Update the global CTF state row.
        """
        row = await self.get_state()
        row.active = active
        row.ends_at = ends_at
        row.started_by_user_id = started_by_user_id
        row.started_at = started_at
        self.async_session.add(row)
        await self.async_session.commit()
        await self.async_session.refresh(row)
        return row

    async def is_ctf_open(self) -> bool:
        """
        True if CTF is active and not past ends_at (if ends_at is set).
        """
        state = await self.get_state()
        if not state.active:
            return False
        if state.ends_at is None:
            return True
        return state.ends_at >= datetime.now(timezone.utc)

    async def pause(self) -> CTFStateTable:
        state = await self.get_state()
        now = datetime.now(timezone.utc)

        remaining = None
        remaining = max(0, int((state.ends_at - now).total_seconds())) if state.ends_at else None

        state.active = False
        state.paused_remaining_seconds = remaining
        await self.async_session.commit()
        await self.async_session.refresh(state)
        return state

    async def resume(self, *, default_duration_seconds: int) -> CTFStateTable:
        state = await self.get_state()
        now = datetime.now(timezone.utc)

        remaining = state.paused_remaining_seconds
        if isinstance(remaining, int) and remaining > 0:
            state.ends_at = now + timedelta(seconds=remaining)
        else:
            state.ends_at = now + timedelta(seconds=int(default_duration_seconds))

        state.active = True
        state.paused_remaining_seconds = None
        state.started_at = now
        await self.async_session.commit()
        await self.async_session.refresh(state)
        return state
