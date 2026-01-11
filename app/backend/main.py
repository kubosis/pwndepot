import os

import fastapi
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.backend.api.v1.router import api_router
from app.backend.config.settings import BackendBaseSettings, get_settings
from app.backend.middleware.ctf_gate import CTFGateMiddleware
from app.backend.middleware.origin_check import OriginCheckMiddleware
from app.backend.utils.ctf_redis import ctf_redis_bus
from app.backend.utils.k8s_manager import K8sChallengeManager
from app.backend.utils.limiter import limiter
from app.backend.utils.logging_config import setup_logging
from app.backend.utils.redis_sse_listener import (
    start_redis_sse_listener,
    stop_redis_sse_listener,
)


def _create_fastapi_backend(app_settings: BackendBaseSettings) -> fastapi.FastAPI:
    """
    Create and configure the FastAPI backend application:
    - CORS (dynamic dev/prod)
    - Rate limiting
    - Routers
    """
    K8sChallengeManager()  # noqa: we want to force k8s singleton manager initialization here
    backend_app = fastapi.FastAPI(**app_settings.backend_app_attributes)

    # -----------------------------------------
    # Redis - SSE bridge (MULTI-WORKER SAFE)
    # -----------------------------------------
    backend_app.add_event_handler(
        "startup",
        start_redis_sse_listener,
    )

    backend_app.add_event_handler(
        "shutdown",
        stop_redis_sse_listener,
    )

    backend_app.add_event_handler("shutdown", ctf_redis_bus.close)

    # -----------------------------------------
    # CTF Gate (global lock when CTF ended)
    # -----------------------------------------
    backend_app.add_middleware(
        CTFGateMiddleware,
        allowlist_exact={
            "/",
            "/contact",
            "/privacy-policy",
            "/terms-of-service",
            "/acceptable-use-policy",
            "/legal-notice",
            "/api/v1/users/logout",
            "/api/v1/users/logout/force",
            "/api/v1/users/auth/refresh",
            "/rankings",
            "/read-more",
            "/api/v1/ctf-events",
            "/api/v1/ctf-status",
        },
        allowlist_prefixes=(
            "/assets",
            "/favicon",
            "/robots.txt",
            "/api/v1/mfa",
            "/api/v1/ctf-status",
            "/team/",
            "/profile/",
        ),
    )

    # -----------------------------------------
    # Rate limiting middleware
    # -----------------------------------------
    backend_app.state.limiter = limiter
    backend_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    backend_app.add_middleware(SlowAPIMiddleware)

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
    # CSRF / Origin check middleware
    # -----------------------------------------
    backend_app.add_middleware(
        OriginCheckMiddleware,
        allowed_origins=app_settings.ALLOWED_ORIGINS_LIST,
        # enabled=app_settings.ENV == "prod",
    )

    # -----------------------------------------
    # Proxy headers (REAL IP) - only if behind trusted proxies
    # -----------------------------------------
    trusted = settings.TRUSTED_PROXY_IPS_LIST or ["127.0.0.1"]

    backend_app.add_middleware(
        ProxyHeadersMiddleware,
        trusted_hosts=trusted,
    )

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
        host=settings.UVICORN_SERVER_HOST,
        port=settings.UVICORN_SERVER_PORT,
        reload=settings.DEBUG
        and os.getenv("RUNNING_IN_DOCKER", "0") != "1",  # disable reload in docker to avoid issues with file watchers
        workers=1,  # workers > 1 breaks reload + rate limiter in dev
        log_level=settings.UVICORN_LOGGING_LEVEL,
    )
