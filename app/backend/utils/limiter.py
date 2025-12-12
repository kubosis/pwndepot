# app/backend/limiter.py

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.backend.config.settings import get_settings

settings = get_settings()

# Global Limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)
