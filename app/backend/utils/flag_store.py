import redis.asyncio as redis

from app.backend.config.settings import get_settings

settings = get_settings()


class RedisFlagStore:
    """
    Simple helper to store and retrieve per-instance flags in Redis with TTL.
    Key format: ctf:flag:{user_id}:{challenge_id}
    """

    def __init__(self) -> None:
        self._r = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _key(self, user_id: int, challenge_id: int) -> str:
        return f"ctf:flag:{user_id}:{challenge_id}"

    async def set_flag(self, user_id: int, challenge_id: int, flag: str, ttl_seconds: int) -> None:
        await self._r.set(self._key(user_id, challenge_id), flag, ex=ttl_seconds)

    async def get_flag(self, user_id: int, challenge_id: int) -> str | None:
        return await self._r.get(self._key(user_id, challenge_id))

    async def delete_flag(self, user_id: int, challenge_id: int) -> None:
        await self._r.delete(self._key(user_id, challenge_id))


class TeamFlagStore:
    """
    Stores and retrieves per-team flags in Redis with TTL.
    Key format: ctf:flag:team:{team_id}:{challenge_id}
    """

    def __init__(self) -> None:
        self._r = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _key(self, team_id: int, challenge_id: int) -> str:
        return f"ctf:flag:team:{team_id}:{challenge_id}"

    async def set_flag(self, team_id: int, challenge_id: int, flag: str, ttl_seconds: int) -> None:
        await self._r.set(self._key(team_id, challenge_id), flag, ex=ttl_seconds)

    async def get_flag(self, team_id: int, challenge_id: int) -> str | None:
        return await self._r.get(self._key(team_id, challenge_id))

    async def delete_flag(self, team_id: int, challenge_id: int) -> None:
        await self._r.delete(self._key(team_id, challenge_id))
