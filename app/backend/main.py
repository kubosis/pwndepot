import os

import fastapi
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.backend.api.v1.router import api_router
from app.backend.config.settings import BackendBaseSettings, get_settings
from app.backend.utils.logging_config import setup_logging


def _create_fastapi_backend(app_settings: BackendBaseSettings) -> fastapi.FastAPI:
    """
    Create and configure the FastAPI backend application:
    - CORS (dynamic dev/prod)
    - Rate limiting
    - Routers
    """

    # -----------------------------------------
    # RATE LIMITING
    # -----------------------------------------
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[f"{app_settings.RATE_LIMIT_PER_MINUTE}/minute"],
    )

    backend_app = fastapi.FastAPI(**app_settings.backend_app_attributes)

    # -----------------------------------------
    # CORS — dynamic by environment
    # -----------------------------------------
    backend_app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.ALLOWED_ORIGINS_LIST,
        allow_credentials=True,  ## required for HTTP cookies
        allow_methods=app_settings.ALLOWED_METHODS,
        allow_headers=app_settings.ALLOWED_HEADERS,
    )

    # -----------------------------------------
    # Rate limiting middleware
    # -----------------------------------------
    backend_app.state.limiter = limiter
    backend_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    backend_app.add_middleware(SlowAPIMiddleware)

    # -----------------------------------------
    # Routes
    # -----------------------------------------

    backend_app.include_router(api_router)

    return backend_app


# -----------------------------
# LOAD SETTINGS & START APP
# -----------------------------
settings = get_settings()

setup_logging()

app = _create_fastapi_backend(settings)


if __name__ == "__main__":
    uvicorn.run(
        "app.backend.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG
        and os.getenv("RUNNING_IN_DOCKER", "0") != "1",  # disable reload in docker to avoid issues with file watchers
        workers=1,  # workers > 1 breaks reload + rate limiter in dev
        log_level=settings.LOGGING_LEVEL,
    )
