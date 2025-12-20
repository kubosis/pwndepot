from app.backend.config.redis import redis_client
from app.backend.config.settings import get_settings

settings = get_settings()

ADMIN_MFA_TTL = 60  # seconds


def _key(admin_id: int) -> str:
    return f"admin:mfa:{admin_id}"


async def mark_admin_mfa_verified(admin_id: int):
    await redis_client.set(_key(admin_id), "1", ex=ADMIN_MFA_TTL)


async def is_admin_mfa_valid(admin_id: int) -> bool:
    return await redis_client.exists(_key(admin_id)) == 1


async def consume_admin_mfa(admin_id: int):
    await redis_client.delete(_key(admin_id))


async def clear_admin_mfa(admin_id: int):
    await redis_client.delete(_key(admin_id))
