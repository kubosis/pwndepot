from __future__ import annotations

import asyncio
import contextlib
import json
from collections.abc import AsyncGenerator

import fastapi
from fastapi import Request
from starlette.responses import StreamingResponse

from app.backend.config.redis import redis_client
from app.backend.config.settings import get_settings
from app.backend.utils.limiter import limiter
from app.backend.utils.sse_bus import sse_bus

settings = get_settings()

router = fastapi.APIRouter(tags=["ctf"])


def _sse_frame(event: str, data_obj) -> bytes:
    """
    SSE frame:
      event: <event>\n
      data: <json>\n
      \n
    """
    data = json.dumps(data_obj, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n".encode()


MAX_SSE_CONNECTIONS_PER_IP = settings.MAX_SSE_CONNECTIONS_PER_IP
SSE_CONN_TTL_SECONDS = settings.SSE_CONN_TTL_SECONDS


def _sse_conn_key(ip: str) -> str:
    return f"sse:ctf:ip:{ip}"


@router.get("/ctf-events")
@limiter.limit("20/minute")
async def ctf_events(request: Request):
    """
    SSE stream.
    Expects messages from sse_bus as JSON string: {"event":"ctf_changed","data":{...}}
    Sends SSE event name == payload.event, and data == payload.data
    """

    ip = request.client.host if request.client else "unknown"
    key = _sse_conn_key(ip)

    current = await redis_client.incr(key)
    if current == 1:
        await redis_client.expire(key, SSE_CONN_TTL_SECONDS)

    if current > MAX_SSE_CONNECTIONS_PER_IP:
        await redis_client.decr(key)
        raise fastapi.HTTPException(status_code=429, detail="Too many SSE connections")

    q = await sse_bus.subscribe()

    async def gen() -> AsyncGenerator[bytes, None]:
        # Initial hello (optional)
        yield _sse_frame("hello", {"ok": True})

        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    raw = await asyncio.wait_for(q.get(), timeout=15.0)

                    # raw is JSON string: {"event": "...", "data": ...}
                    try:
                        payload = json.loads(raw)
                    except Exception:
                        # if something malformed gets into the bus, skip it
                        continue

                    event = payload.get("event") or "ctf_changed"
                    data = payload.get("data")

                    # send as real SSE event
                    yield _sse_frame(event, data)

                except asyncio.TimeoutError:
                    # keep-alive ping to prevent proxies closing connection
                    with contextlib.suppress(Exception):
                        await redis_client.expire(key, SSE_CONN_TTL_SECONDS)
                    yield _sse_frame("ping", {"t": 1})
        finally:
            await sse_bus.unsubscribe(q)
            with contextlib.suppress(Exception):
                await redis_client.decr(key)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        # if behind nginx, this helps:
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)
