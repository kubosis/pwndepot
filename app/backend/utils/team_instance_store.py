# app/backend/utils/team_instance_store.py
import json
from datetime import datetime, timedelta, timezone

import redis.asyncio as redis

from app.backend.config.settings import get_settings

settings = get_settings()


class TeamInstanceStore:
    def __init__(self) -> None:
        self._r = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _key(self, team_id: int, challenge_id: int) -> str:
        return f"ctf:instance:team:{team_id}:{challenge_id}"

    async def get(self, team_id: int, challenge_id: int) -> dict | None:
        raw = await self._r.get(self._key(team_id, challenge_id))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def claim_or_get(
        self,
        team_id: int,
        challenge_id: int,
        *,
        ttl_seconds: int,
    ) -> tuple[bool, dict]:
        """
        Atomowo:
        - jeśli nie ma instancji -> zakłada placeholder i zwraca (True, payload)
        - jeśli jest -> zwraca (False, existing)
        """
        now = datetime.now(timezone.utc)
        exp = now + timedelta(seconds=ttl_seconds)
        payload = {
            "team_id": team_id,
            "challenge_id": challenge_id,
            "connection": None,  # we will fill it later after instance is ready
            "started_at": now.isoformat(),
            "expires_at": exp.isoformat(),
            "status": "starting",
        }

        key = self._key(team_id, challenge_id)
        ok = await self._r.set(key, json.dumps(payload), ex=ttl_seconds, nx=True)
        if ok:
            return True, payload

        existing = await self.get(team_id, challenge_id)
        return False, existing or payload

    async def update_expires(self, team_id: int, challenge_id: int, *, ttl_seconds: int) -> dict | None:
        existing = await self.get(team_id, challenge_id)
        if not existing:
            return None
        now = datetime.now(timezone.utc)
        existing["expires_at"] = (now + timedelta(seconds=ttl_seconds)).isoformat()
        await self._r.set(self._key(team_id, challenge_id), json.dumps(existing), ex=ttl_seconds)
        return existing

    async def delete(self, team_id: int, challenge_id: int) -> None:
        await self._r.delete(self._key(team_id, challenge_id))

    async def set(
        self,
        team_id: int,
        challenge_id: int,
        *,
        connection: str,
        ttl_seconds: int,
        protocol: str | None = None,
        tcp_host: str | None = None,
        tcp_port: int | None = None,
        passphrase: str | None = None,
    ) -> dict | None:
        existing = await self.get(team_id, challenge_id)
        if not existing:
            return None

        existing["connection"] = connection
        existing["status"] = "running"

        if protocol is not None:
            existing["protocol"] = protocol
        if tcp_host is not None:
            existing["tcp_host"] = tcp_host
        if tcp_port is not None:
            existing["tcp_port"] = tcp_port
        if passphrase is not None:
            existing["passphrase"] = passphrase

        now = datetime.now(timezone.utc)
        existing["expires_at"] = (now + timedelta(seconds=ttl_seconds)).isoformat()

        await self._r.set(self._key(team_id, challenge_id), json.dumps(existing), ex=ttl_seconds)
        return existing

    async def force_set(self, team_id: int, challenge_id: int, payload: dict, *, ttl_seconds: int) -> None:
        await self._r.set(self._key(team_id, challenge_id), json.dumps(payload), ex=ttl_seconds)
