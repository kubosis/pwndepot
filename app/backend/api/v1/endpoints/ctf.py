# app/backend/api/v1/endpoints/ctf.py


from datetime import datetime, timedelta, timezone

import fastapi
from fastapi import Body, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.backend.api.v1.deps import get_current_admin, get_db
from app.backend.db.models import UserTable
from app.backend.repository.ctf_state import CTFStateRepository
from app.backend.schema.ctf import CTFStartRequest
from app.backend.utils.ctf_redis import ctf_redis_bus
from app.backend.utils.limiter import rate_limit
from app.backend.utils.limiter_keys import admin_key

router = fastapi.APIRouter(tags=["ctf"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _seconds_left(ends_at: datetime | None, now: datetime) -> int | None:
    if ends_at is None:
        return None
    return max(0, int((ends_at - now).total_seconds()))


@router.get("/ctf-status", response_model=dict, status_code=status.HTTP_200_OK)
@rate_limit("120/minute")
async def get_ctf_status(
    request: Request,
    session: AsyncSession = Depends(get_db),  # Important: explicit Depends to avoid 422
):
    repo = CTFStateRepository(session)
    now = _utcnow()
    state = await repo.get_state()

    active = bool(state.active)

    if active:
        remaining = _seconds_left(state.ends_at, now)

        if remaining is None:
            return {
                "active": True,
                "ends_at": state.ends_at,
                "remaining_seconds": None,
                "paused_remaining_seconds": state.paused_remaining_seconds,
                "started_by": state.started_by_user_id,
                "started_at": state.started_at,
            }

        if remaining == 0:
            state = await repo.set_state(
                active=False,
                ends_at=None,
                started_by_user_id=state.started_by_user_id,
                started_at=state.started_at,
            )
            state.paused_remaining_seconds = 0
            session.add(state)
            await session.commit()
            await session.refresh(state)
            await ctf_redis_bus.publish("ctf_changed", {"action": "ended"})

            return {
                "active": False,
                "ends_at": None,
                "remaining_seconds": 0,
                "paused_remaining_seconds": 0,
                "started_by": state.started_by_user_id,
                "started_at": state.started_at,
            }

        return {
            "active": True,
            "ends_at": state.ends_at,
            "remaining_seconds": remaining,
            "paused_remaining_seconds": state.paused_remaining_seconds,
            "started_by": state.started_by_user_id,
            "started_at": state.started_at,
        }

    paused_left = state.paused_remaining_seconds
    paused_left = max(0, paused_left) if isinstance(paused_left, int) else None

    return {
        "active": False,
        "ends_at": None,
        "remaining_seconds": paused_left,
        "paused_remaining_seconds": paused_left,
        "started_by": state.started_by_user_id,
        "started_at": state.started_at,
    }


@router.post("/ctf-start", response_model=dict, status_code=status.HTTP_200_OK)
@rate_limit("10/minute", key_func=admin_key)
async def start_ctf(
    request: Request,
    start_ctf_req: CTFStartRequest = Body(...),
    current_admin: UserTable = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),  # Important: explicit Depends to avoid 422
):
    repo = CTFStateRepository(session)
    now = _utcnow()
    state = await repo.get_state()

    if state.active:
        remaining = _seconds_left(state.ends_at, now)
        return {
            "message": "CTF already running",
            "ends_at": state.ends_at,
            "remaining_seconds": remaining,
        }

    paused_left = state.paused_remaining_seconds
    if isinstance(paused_left, int) and paused_left > 0:
        ends_at = now + timedelta(seconds=paused_left)
        state = await repo.set_state(
            active=True,
            ends_at=ends_at,
            started_by_user_id=getattr(current_admin, "id", None),
            started_at=state.started_at or now,
        )

        state.paused_remaining_seconds = None
        session.add(state)
        await session.commit()
        await session.refresh(state)
        await ctf_redis_bus.publish("ctf_changed", {"action": "start"})

        return {"message": "CTF resumed", "ends_at": state.ends_at, "remaining_seconds": paused_left}

    duration = int(start_ctf_req.duration_seconds)
    if duration <= 0:
        return {"message": "Invalid duration_seconds", "ends_at": None, "remaining_seconds": None}

    ends_at = now + timedelta(seconds=duration)
    state = await repo.set_state(
        active=True,
        ends_at=ends_at,
        started_by_user_id=getattr(current_admin, "id", None),
        started_at=now,
    )

    state.paused_remaining_seconds = None
    session.add(state)
    await session.commit()
    await session.refresh(state)
    await ctf_redis_bus.publish("ctf_changed", {"action": "start"})

    return {"message": "CTF started", "ends_at": state.ends_at, "remaining_seconds": duration}


@router.post("/ctf-stop", response_model=dict, status_code=status.HTTP_200_OK)
@rate_limit("10/minute", key_func=admin_key)
async def stop_ctf(
    request: Request,
    _: UserTable = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),  # Important: explicit Depends to avoid 422
):
    repo = CTFStateRepository(session)
    now = _utcnow()
    state = await repo.get_state()

    if not state.active:
        paused_left = state.paused_remaining_seconds if isinstance(state.paused_remaining_seconds, int) else None
        return {"message": "CTF already paused", "remaining_seconds": paused_left}

    remaining = _seconds_left(state.ends_at, now)
    if remaining is None:
        remaining = None

    state = await repo.set_state(
        active=False,
        ends_at=None,
        started_by_user_id=state.started_by_user_id,
        started_at=state.started_at,
    )

    state.paused_remaining_seconds = remaining
    session.add(state)
    await session.commit()
    await session.refresh(state)
    await ctf_redis_bus.publish("ctf_changed", {"action": "stop"})

    return {"message": "CTF paused", "remaining_seconds": remaining}
