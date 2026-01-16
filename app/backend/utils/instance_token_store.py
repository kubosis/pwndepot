# app/backend/utils/instance_token_store.py
import json
import secrets

import redis.asyncio as redis

from app.backend.config.settings import get_settings

settings = get_settings()


class InstanceTokenStore:
    def __init__(self) -> None:
        self._r = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _k_http(self, token: str) -> str:
        return f"ctf:token:http:{token}"

    def _k_tcp(self, token: str) -> str:
        return f"ctf:token:tcp:{token}"

    def _k_hs(self, token: str) -> str:
        return f"ctf:handshake:{token}"

    def new_token(self, nbytes: int = 18) -> str:
        return secrets.token_urlsafe(nbytes)

    def new_passphrase(self, length: int = 16) -> str:
        # simple, safe, unambiguous charset
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
        return "".join(secrets.choice(alphabet) for _ in range(length))

    async def set_mapping(self, token: str, *, team_id: int, challenge_id: int, ttl_seconds: int, tcp: bool) -> None:
        payload = json.dumps({"team_id": team_id, "challenge_id": challenge_id})
        if tcp:
            await self._r.set(self._k_tcp(token), payload, ex=ttl_seconds)
        else:
            await self._r.set(self._k_http(token), payload, ex=ttl_seconds)

    async def set_handshake(self, token: str, passphrase: str, ttl_seconds: int) -> None:
        await self._r.set(self._k_hs(token), passphrase, ex=ttl_seconds)

    async def get_mapping(self, token: str, tcp: bool) -> dict | None:
        raw = await self._r.get(self._k_tcp(token) if tcp else self._k_http(token))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def get_handshake(self, token: str) -> str | None:
        return await self._r.get(self._k_hs(token))
