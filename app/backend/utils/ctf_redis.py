# app/backend/utils/ctf_redis.py
from __future__ import annotations

from app.backend.config.settings import get_settings
from app.backend.utils.redis_bus import RedisBus

_settings = get_settings()

# single shared Redis publisher for CTF SSE events
ctf_redis_bus = RedisBus(_settings.REDIS_URL, channel="ctf:sse")
