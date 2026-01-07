import hashlib
import hmac

from loguru import logger
from passlib.context import CryptContext

from app.backend.config.settings import get_settings

settings = get_settings()


class PasswordManager:
    """
    Secure password manager using Argon2id (winner of the Password Hashing Competition)
     and optional pepper (server-side secret).

    Argon2id provides:
    - Automatic unique salt per password
    - Memory-hard algorithm (resistant to GPU/ASIC attacks)
    - Configurable time and memory costs
    """

    def __init__(self):
        self._hash_ctx = CryptContext(schemes=["argon2"], deprecated="auto")
        self._pepper = settings.JWT_HASHING_PEPPER

    def _apply_pepper(self, raw_password: str) -> str:
        """Apply HMAC-based pepper to password before hashing if `HASHING_PEPPER` env was set"""
        if not self._pepper:
            return raw_password
        return hmac.new(self._pepper.encode(), raw_password.encode(), hashlib.sha256).hexdigest()

    def hash_password(self, raw_password: str) -> str:
        peppered = self._apply_pepper(raw_password)
        return self._hash_ctx.hash(peppered)

    def verify_password(self, raw_password: str, hashed_password: str) -> bool:
        peppered = self._apply_pepper(raw_password)
        try:
            result = self._hash_ctx.verify(peppered, hashed_password)
            if not result:
                logger.warning("Password verification failed for a user.")
            return result
        except Exception as e:
            logger.error(f"Password verification error: {e!s}")
            return False
