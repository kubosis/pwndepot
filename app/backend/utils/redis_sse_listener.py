# app/backend/utils/redis_sse_listener.py
from __future__ import annotations

import asyncio
import contextlib
import json
import logging

import redis.asyncio as redis
from app.backend.config.settings import get_settings
from app.backend.utils.sse_bus import sse_bus

log = logging.getLogger(__name__)


class RedisSSEListener:
    """
    Subscribes to Redis Pub/Sub and forwards events to local in-memory SSE bus.
    Multi-worker safe: each worker runs its own listener and fans out to its own clients.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    async def _listen_once(self) -> None:
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("ctf:sse")

        log.info("Redis SSE listener connected (channel: ctf:sse)")

        try:
            async for msg in pubsub.listen():
                if self._stop_event.is_set():
                    break

                if msg.get("type") != "message":
                    continue

                data_raw = msg.get("data")
                try:
                    payload = json.loads(data_raw)
                    event = payload["event"]
                    data = payload.get("data")
                except Exception:
                    log.warning("Invalid redis message: %s", msg)
                    continue

                # fan-out to local SSE clients
                await sse_bus.broadcast(event, data)

        finally:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe("ctf:sse")
            with contextlib.suppress(Exception):
                await pubsub.close()

    async def run_forever(self) -> None:
        backoff = 1.0
        try:
            while not self._stop_event.is_set():
                try:
                    await self._listen_once()
                    backoff = 1.0  # reset after clean run
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    # network/redis restart/etc.
                    log.warning("Redis SSE listener error, reconnecting: %s", e)
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 10.0)
        finally:
            with contextlib.suppress(Exception):
                await self.redis.close()
            log.info("Redis SSE listener stopped")

    async def start(self) -> None:
        if self._task and not self._task.done():
            return  # idempotent
        self._stop_event.clear()
        self._task = asyncio.create_task(self.run_forever())

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        self._task = None


# ---- singleton instance + functions for main.py ----
_listener: RedisSSEListener | None = None


async def start_redis_sse_listener() -> None:
    global _listener
    if _listener is None:
        _listener = RedisSSEListener()
    await _listener.start()


async def stop_redis_sse_listener() -> None:
    global _listener
    if _listener is None:
        return
    await _listener.stop()
    _listener = None
