import logging
from functools import lru_cache
from pathlib import Path

import decouple
from pydantic import field_validator
from pydantic_settings import BaseSettings

backend_settings = None


class BackendBaseSettings(BaseSettings):
    ROOT_DIR: Path = Path(__file__).parent.parent.resolve()

    APP_NAME: str = "PwnDépôt"

    TITLE: str = "ISEP CTF BACKEND"
    VERSION: str = "0.0.1"
    TIMEZONE: str = "CET"
    DESCRIPTION: str | None = "Backend API for ISEP CTF WEBPROJECT"

    COOKIE_DOMAIN: str | None = None

    LOGO_PATH: Path = Path("/project/assets/pwndepot_standard.png")

    # REQUIRED FOR TEAM INVITES (Fix)
    FRONTEND_DOMAIN: str = decouple.config("FRONTEND_DOMAIN", default="http://localhost")
    INVITE_EXCHANGE_TTL_SECONDS: int = 24 * 3600  # 24 hours

    # -----------------------------
    # ENVIRONMENT MODE (dev / prod)
    # -----------------------------
    ENV: str = decouple.config("ENV", default="dev").lower()
    assert ENV in ["dev", "prod"], f"Error: Unknown ENV={ENV} setting, Aborting Server"
    DEBUG: bool = ENV == "dev"

    TRUSTED_PROXY_IPS: str = decouple.config("TRUSTED_PROXY_IPS", default="")

    @property
    def TRUSTED_PROXY_IPS_LIST(self) -> list[str]:
        return [x.strip() for x in self.TRUSTED_PROXY_IPS.split(",") if x.strip()]

    # -----------------------------
    # SQLALCHEMY CONNECTION STRINGS
    # -----------------------------
    # Database connection URLs (the .env in this project defines separate vars for PROD/DEV)
    SQLALCHEMY_POSTGRE_ASYNC_URL: str | None = decouple.config("SQLALCHEMY_POSTGRE_ASYNC_URL", default=None)
    SQLALCHEMY_POSTGRE_SYNC_URL: str | None = decouple.config("SQLALCHEMY_POSTGRE_SYNC_URL", default=None)

    @property
    def SQLALCHEMY_DATABASE_ASYNC_URL(self) -> str:
        # 1. Prioritize Postgres if configured (Works for Prod & Dev)
        if self.SQLALCHEMY_POSTGRE_ASYNC_URL:
            return self.SQLALCHEMY_POSTGRE_ASYNC_URL

        raise ValueError("Async DB URL is not configured")

    @property
    def SQLALCHEMY_DATABASE_SYNC_URL(self) -> str:
        # 1. Prioritize Postgres if configured
        if self.SQLALCHEMY_POSTGRE_SYNC_URL:
            return self.SQLALCHEMY_POSTGRE_SYNC_URL

        raise ValueError("Sync DB URL is not configured")

    RATE_LIMIT_PER_MINUTE: int = decouple.config("RATE_LIMIT_PER_MINUTE", cast=int)

    # -----------------------------
    # REDIS
    # -----------------------------

    REDIS_URL: str = decouple.config("REDIS_URL", default="redis://localhost:6379/0")
    ADMIN_MFA_TTL_SECONDS: int = 60

    # -----------------------------
    # SERVER SETTINGS (UVICORN)
    # -----------------------------
    UVICORN_SERVER_HOST: str = decouple.config("UVICORN_SERVER_HOST")
    UVICORN_SERVER_PORT: int = decouple.config("UVICORN_SERVER_PORT", cast=int)
    # LOGGING
    UVICORN_LOGGING_LEVEL: int = logging.INFO
    LOGGERS: tuple[str, str] = ("uvicorn.asgi", "uvicorn.access")
    UVICORN_SERVER_WORKERS: int = decouple.config("SERVER_WORKERS", cast=int)

    ACCESS_TOKEN_EXPIRE_MINUTES: int = decouple.config("ACCESS_TOKEN_EXPIRE_MINUTES", cast=int)

    # -----------------------------
    # CORS — dynamic by ENV
    # -----------------------------
    ALLOWED_ORIGINS: str = decouple.config("ALLOWED_ORIGINS", default="http://localhost")

    @property
    def ALLOWED_ORIGINS_LIST(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    ALLOWED_METHODS: list[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    ALLOWED_HEADERS: list[str] = ["Authorization", "Content-Type", "X-CSRF-Token"]
    IS_ALLOWED_CREDENTIALS: bool = True  # must stay true for cookies

    # -----------------------------
    # EMAIL / SMTP
    # -----------------------------
    SMTP_HOST: str = decouple.config("SMTP_HOST")
    SMTP_PORT: int = decouple.config("SMTP_PORT", cast=int, default=587)
    SMTP_USE_TLS: bool = decouple.config("SMTP_USE_TLS", cast=bool, default=False)

    SMTP_USERNAME: str = decouple.config("SMTP_USERNAME")
    SMTP_PASSWORD: str = decouple.config("SMTP_PASSWORD")

    MAIL_FROM: str = decouple.config("MAIL_FROM")
    CONTACT_RECEIVER_EMAIL: str = decouple.config("CONTACT_RECEIVER_EMAIL")

    SMTP_MAX_RETRIES: int = 3
    SMTP_RETRY_DELAY_SECONDS: int = 2
    UNVERIFIED_TTL_DAYS: int = 7
    SPAM_WINDOW_MINUTES: int = 5

    # -----------------------------
    # JWT & SECURITY
    # -----------------------------
    JWT_ALGORITHM: str = decouple.config("JWT_ALGORITHM")
    JWT_SECRET_KEY: str = decouple.config("JWT_SECRET_KEY")
    JWT_HASHING_PEPPER: str | None = decouple.config("JWT_HASHING_PEPPER", default=None)
    ADMIN_MFA_TTL: int = 60  # seconds

    # -----------------------------
    # SSE SETTINGS
    # -----------------------------
    MAX_SSE_CONNECTIONS_PER_IP: int = 3
    SSE_CONN_TTL_SECONDS: int = 60

    # -----------------------------
    # API ROUTING
    # -----------------------------
    API_VERSION: str = decouple.config("API_VERSION", default="v1")
    API_PREFIX: str = f"api/{API_VERSION}"

    DOCS_URL: str | None = "/docs" if ENV == "dev" else None
    OPENAPI_URL: str | None = "/openapi.json" if ENV == "dev" else None
    REDOC_URL: str | None = "/redoc" if ENV == "dev" else None
    OPENAPI_PREFIX: str = ""

    MFA_TOKEN_EXPIRATION_MINS: int = decouple.config("MFA_TOKEN_EXPIRATION_MINS", default=2)

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
        return True  # always true - protects against XSS

    # =============================
    # TCP CHALLENGES (NODEPORT)
    # =============================
    PUBLIC_TCP_HOST: str = decouple.config("PUBLIC_TCP_HOST", default="pwndep0t.com")

    # -----------------------------
    # SECURITY VALIDATION
    # -----------------------------
    @field_validator("JWT_SECRET_KEY")
    def _validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long for security.")
        return v

    K8S_CHALLENGE_NAMESPACE: str = decouple.config("K8S_CHALLENGE_NAMESPACE", default="ctf-challenges")
    CHALLENGE_K8S_POD_TTL_SECONDS: int = decouple.config("CHALLENGE_K8S_POD_TTL_SECONDS", cast=int, default=3600)
    MAX_ACTIVE_INSTANCES: int = decouple.config("MAX_ACTIVE_INSTANCES", cast=int, default=50)

    def load_k8s_config(self):
        import os

        from kubernetes import config

        try:
            # are we in k8s cluster?
            if os.getenv("KUBERNETES_SERVICE_HOST"):
                config.load_incluster_config()
                print("Loaded in-cluster K8s config (running inside K8s).")
            else:
                # Fallback: We are running locally
                config.load_kube_config()
                print("Loaded local K8s config (running outside K8s).")
        except Exception as e:
            print(f"Warning: Could not load K8s config: {e}")

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
