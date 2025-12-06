import logging
from pathlib import Path

import decouple
import pydantic_settings
from charset_normalizer.md import lru_cache

backend_settings = None


class BackendBaseSettings(pydantic_settings.BaseSettings):
    ROOT_DIR: Path = Path(__file__).parent.parent.resolve()

    TITLE: str = "ISEP CTF BACKEND"
    VERSION: str = "0.0.1"
    TIMEZONE: str = "CET"
    DESCRIPTION: str | None = "Backend API for ISEP CTF WEBPROJECT"
    ENV: str = decouple.config("ENV", default="dev", cast=str)  # type: ignore
    DEBUG: bool = ENV == "dev"

    SQLALCHEMY_DATABASE_URL: str = decouple.config("SQLALCHEMY_DATABASE_URL", cast=str)  # type: ignore

    RATE_LIMIT_PER_MINUTE: int = decouple.config("RATE_LIMIT_PER_MINUTE", cast=int)  # type: ignore

    # Server settings
    SERVER_HOST: str = decouple.config("SERVER_HOST", cast=str)  # type: ignore
    SERVER_PORT: int = decouple.config("SERVER_PORT", cast=int)  # type: ignore

    ACCESS_TOKEN_EXPIRE_MINUTES: int = decouple.config("ACCESS_TOKEN_EXPIRE_MINUTES", cast=int)  # type: ignore

    # CORS middleware settings
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://0.0.0.0:3000",
        "http://127.0.0.1:3000",
    ]

    ALLOWED_METHODS: list[str] = ["*"]
    ALLOWED_HEADERS: list[str] = ["*"]
    IS_ALLOWED_CREDENTIALS: bool = True

    LOGGING_LEVEL: int = logging.INFO
    LOGGERS: tuple[str, str] = ("uvicorn.asgi", "uvicorn.access")
    SERVER_WORKERS: int = decouple.config("SERVER_WORKERS", cast=int)  # type: ignore

    # FastAPI settings
    API_VERSION: str = "v1"
    API_PREFIX: str = f"api/{API_VERSION}"
    DOCS_URL: str = "/docs"
    OPENAPI_URL: str = "/openapi.json"
    REDOC_URL: str = "/redoc"
    OPENAPI_PREFIX: str = ""

    JWT_ALGORITHM: str = decouple.config("JWT_ALGORITHM", cast=str)  # type: ignore
    SECRET_KEY: str = decouple.config("SECRET_KEY", cast=str)  # type: ignore
    HASHING_PEPPER: str | None = decouple.config("HASHING_PEPPER", cast=str, default=None)  # type: ignore

    API_V1_STR: str = API_PREFIX

    @property
    def backend_app_attributes(self) -> dict[str, str | bool | None]:
        """
        Set all `FastAPI` class' attributes with the custom values defined in `BackendBaseSettings`.
        """
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
    if not backend_settings:
        backend_settings = BackendBaseSettings()
    return backend_settings
