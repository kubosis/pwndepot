# app/backend/utils/sse_bus.py
from __future__ import annotations

import asyncio
import contextlib
import json
from typing import Any


class SSEBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        async with self._lock:
            self._subscribers.discard(q)

    async def broadcast(self, event: str, data: Any | None = None) -> None:
        payload = {"event": event, "data": data}
        msg = json.dumps(payload, separators=(",", ":"))

        async with self._lock:
            subs = list(self._subscribers)

        for q in subs:
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(msg)

sse_bus = SSEBus()
