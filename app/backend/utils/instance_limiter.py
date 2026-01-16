# app/backend/utils/instance_limiter.py
import time

import redis.asyncio as redis

from app.backend.config.settings import get_settings

settings = get_settings()


class InstanceLimiter:
    """
    Slot-based limiter with TTL per (team_id, challenge_id) and a global cap.

    Atomic via Lua:
    - cleanup expired ZSET members (and delete slot keys best-effort)
    - enforce global limit
    - SET slot_key NX EX ttl
    - ZADD slot_key with score=expires_epoch
    """

    ZSET_KEY = "ctf:instances:active_zset"

    _LUA_TRY_ACQUIRE = r"""
    -- KEYS[1] = ZSET_KEY
    -- KEYS[2] = SLOT_KEY
    -- ARGV[1] = now_epoch
    -- ARGV[2] = exp_epoch
    -- ARGV[3] = ttl_seconds
    -- ARGV[4] = limit

    local zset = KEYS[1]
    local slot = KEYS[2]
    local now = tonumber(ARGV[1])
    local exp = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])
    local limit = tonumber(ARGV[4])

    -- 1) cleanup expired
    local expired = redis.call("ZRANGEBYSCORE", zset, "-inf", now)
    if expired and #expired > 0 then
        for i=1,#expired do
            redis.call("DEL", expired[i]) -- best-effort; key may already be gone
        end
        redis.call("ZREM", zset, unpack(expired))
    end

    -- 2) if slot already exists -> refresh index and TTL (idempotent)
    if redis.call("EXISTS", slot) == 1 then
        redis.call("ZADD", zset, exp, slot)
        redis.call("EXPIRE", slot, ttl)
        return 1
    end

    -- 3) enforce global limit
    local count = redis.call("ZCARD", zset)
    if count >= limit then
        return 0
    end

    -- 4) try create slot
    local ok = redis.call("SET", slot, "1", "EX", ttl, "NX")
    if not ok then
        -- someone else created concurrently
        redis.call("ZADD", zset, exp, slot)
        return 1
    end

    -- 5) index it
    redis.call("ZADD", zset, exp, slot)
    return 1
    """

    def __init__(self) -> None:
        self._r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self._try_acquire_sha: str | None = None

    def _slot_key(self, team_id: int, challenge_id: int) -> str:
        return f"ctf:active:team:{team_id}:challenge:{challenge_id}"

    async def _ensure_sha(self) -> str:
        if self._try_acquire_sha:
            return self._try_acquire_sha
        sha = await self._r.script_load(self._LUA_TRY_ACQUIRE)
        self._try_acquire_sha = sha
        return sha

    async def try_acquire(self, *, team_id: int, challenge_id: int, ttl_seconds: int, limit: int) -> bool:
        slot_key = self._slot_key(team_id, challenge_id)
        now = int(time.time())
        exp = now + int(ttl_seconds)

        sha = await self._ensure_sha()
        try:
            res = await self._r.evalsha(
                sha,
                2,
                self.ZSET_KEY,
                slot_key,
                now,
                exp,
                int(ttl_seconds),
                int(limit),
            )
        except redis.exceptions.NoScriptError:
            # Redis lost scripts (restart) -> reload and retry once
            self._try_acquire_sha = None
            sha = await self._ensure_sha()
            res = await self._r.evalsha(
                sha,
                2,
                self.ZSET_KEY,
                slot_key,
                now,
                exp,
                int(ttl_seconds),
                int(limit),
            )

        return int(res) == 1

    async def release(self, *, team_id: int, challenge_id: int) -> None:
        slot_key = self._slot_key(team_id, challenge_id)
        pipe = self._r.pipeline()
        pipe.delete(slot_key)
        pipe.zrem(self.ZSET_KEY, slot_key)
        await pipe.execute()

    async def extend(self, *, team_id: int, challenge_id: int, ttl_seconds: int) -> bool:
        slot_key = self._slot_key(team_id, challenge_id)
        exists = await self._r.exists(slot_key)
        if not exists:
            return False

        now = int(time.time())
        exp = now + int(ttl_seconds)

        pipe = self._r.pipeline()
        pipe.expire(slot_key, int(ttl_seconds))
        pipe.zadd(self.ZSET_KEY, {slot_key: exp})
        await pipe.execute()
        return True
