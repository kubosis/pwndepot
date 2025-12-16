import logging
from functools import lru_cache
from pathlib import Path

import decouple
from pydantic import field_validator
from pydantic_settings import BaseSettings

backend_settings = None


class BackendBaseSettings(BaseSettings):
    ROOT_DIR: Path = Path(__file__).parent.parent.resolve()

    TITLE: str = "ISEP CTF BACKEND"
    VERSION: str = "0.0.1"
    TIMEZONE: str = "CET"
    DESCRIPTION: str | None = "Backend API for ISEP CTF WEBPROJECT"

    COOKIE_DOMAIN: str = "localhost"

    # REQUIRED FOR TEAM INVITES (Fix)
    FRONTEND_DOMAIN: str = decouple.config("FRONTEND_DOMAIN", default="http://localhost:5173")

    # -----------------------------
    # ENVIRONMENT MODE (dev / prod)
    # -----------------------------
    ENV: str = decouple.config("ENV", default="dev")
    DEBUG: bool = ENV == "dev"

    SQLALCHEMY_DATABASE_URL: str = decouple.config("SQLALCHEMY_DATABASE_URL")

    RATE_LIMIT_PER_MINUTE: int = decouple.config("RATE_LIMIT_PER_MINUTE", cast=int)

    # -----------------------------
    # SERVER SETTINGS
    # -----------------------------
    SERVER_HOST: str = decouple.config("SERVER_HOST")
    SERVER_PORT: int = decouple.config("SERVER_PORT", cast=int)

    ACCESS_TOKEN_EXPIRE_MINUTES: int = decouple.config("ACCESS_TOKEN_EXPIRE_MINUTES", cast=int)

    # -----------------------------
    # CORS — dynamic by ENV
    # -----------------------------
    ALLOWED_ORIGINS: str = decouple.config("ALLOWED_ORIGINS", default="http://localhost:5173")

    @property
    def ALLOWED_ORIGINS_LIST(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    ALLOWED_METHODS: list[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    ALLOWED_HEADERS: list[str] = ["Authorization", "Content-Type"]
    IS_ALLOWED_CREDENTIALS: bool = True  # must stay true for cookies

    # -----------------------------
    # EMAIL / SMTP
    # -----------------------------
    SMTP_HOST: str = decouple.config("SMTP_HOST")
    SMTP_PORT: int = decouple.config("SMTP_PORT", cast=int, default=587)
    SMTP_USE_TLS: bool = decouple.config("SMTP_USE_TLS", cast=bool, default=True)

    SMTP_USERNAME: str = decouple.config("SMTP_USERNAME")
    SMTP_PASSWORD: str = decouple.config("SMTP_PASSWORD")

    MAIL_FROM: str = decouple.config("MAIL_FROM")
    CONTACT_RECEIVER_EMAIL: str = decouple.config("CONTACT_RECEIVER_EMAIL")


    # -----------------------------
    # LOGGING
    # -----------------------------
    LOGGING_LEVEL: int = logging.INFO
    LOGGERS: tuple[str, str] = ("uvicorn.asgi", "uvicorn.access")
    SERVER_WORKERS: int = decouple.config("SERVER_WORKERS", cast=int)

    # -----------------------------
    # JWT & SECURITY
    # -----------------------------
    JWT_ALGORITHM: str = decouple.config("JWT_ALGORITHM")
    SECRET_KEY: str = decouple.config("SECRET_KEY")
    HASHING_PEPPER: str | None = decouple.config("HASHING_PEPPER", default=None)

    # -----------------------------
    # API ROUTING
    # -----------------------------
    API_VERSION: str = "v1"
    API_PREFIX: str = f"api/{API_VERSION}"
    API_V1_STR: str = API_PREFIX

    DOCS_URL: str = "/docs" if ENV == "dev" else None
    OPENAPI_URL: str = "/openapi.json" if ENV == "dev" else None
    REDOC_URL: str = "/redoc" if ENV == "dev" else None
    OPENAPI_PREFIX: str = ""

    # -----------------------------
    # COOKIE SECURITY (DEV vs PROD)
    # -----------------------------
    @property
    def COOKIE_SECURE(self) -> bool:
        """
        In production → cookies require HTTPS
        In development → HTTPS not required
        """
        return self.ENV == "prod"

    @property
    def COOKIE_SAMESITE(self) -> str:
        """
        Prevents CSRF in production (Strict)
        Allows convenience during development (Lax)
        """
        return "strict" if self.ENV == "prod" else "lax"

    @property
    def COOKIE_HTTPONLY(self) -> bool:
        return True  # always true — protects against XSS

    # -----------------------------
    # SECURITY VALIDATION
    # -----------------------------
    @field_validator("SECRET_KEY")
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long for security.")
        return v

    @property
    def backend_app_attributes(self) -> dict[str, str | bool | None]:
        return {
            "title": self.TITLE,
            "version": self.VERSION,
            "debug": self.DEBUG,
            "description": self.DESCRIPTION,
            "docs_url": self.DOCS_URL,
            "openapi_url": self.OPENAPI_URL,
            "redoc_url": self.REDOC_URL,
            "openapi_prefix": self.OPENAPI_PREFIX,
            "api_prefix": self.API_PREFIX,
        }


@lru_cache
def get_settings() -> BackendBaseSettings:
    global backend_settings
    if backend_settings is None:
        backend_settings = BackendBaseSettings()
    return backend_settings
