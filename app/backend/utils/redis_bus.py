# app/backend/utils/redis_bus.py
from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis


class RedisBus:
    def __init__(self, redis_url: str, channel: str = "ctf:sse") -> None:
        self.redis_url = redis_url
        self.channel = channel
        self._r: redis.Redis | None = None

    async def connect(self) -> None:
        if self._r is None:
            self._r = redis.from_url(self.redis_url, decode_responses=True)

    async def close(self) -> None:
        if self._r is not None:
            await self._r.close()
            self._r = None

    async def publish(self, event: str, data: Any | None = None) -> None:
        await self.connect()
        payload = {"event": event, "data": data}
        msg = json.dumps(payload, separators=(",", ":"))
        # publish to redis channel
        await self._r.publish(self.channel, msg)

    async def subscribe(self):
        """
        Returns async iterator of messages (strings) from Redis channel.
        """
        await self.connect()
        pubsub = self._r.pubsub()
        await pubsub.subscribe(self.channel)
        return pubsub
