import fastapi
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.backend.api.v1.router import api_router
from app.backend.config.settings import BackendBaseSettings, get_settings
from app.backend.logging_config import setup_logging


def _create_fastapi_backend(app_settings: BackendBaseSettings) -> fastapi.FastAPI:
    """
    Create and configure the FastAPI backend application:
    - CORS
    - rate limiting (SlowAPI)
    - API routers
    """

    # Global rate limiter (example: 1 request per minute per IP)
    limiter = Limiter(key_func=get_remote_address, default_limits=["1/minute"])

    # Create FastAPI app using attributes from settings
    backend_app = fastapi.FastAPI(**app_settings.backend_app_attributes)

    # --- CORS CONFIG (DEV) ---
    # For local development, explicitly allow the Vite dev server.
    # In production you should replace these with your real frontend domain(s).
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    backend_app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,       # allowed frontend origins
        allow_credentials=False,     # no cookies; we send Bearer tokens in headers
        allow_methods=["*"],         # allow all HTTP methods in dev
        allow_headers=["*"],         # allow all headers in dev
    )

    # --- Rate limiting for all endpoints ---
    backend_app.state.limiter = limiter
    backend_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    backend_app.add_middleware(SlowAPIMiddleware)

    # --- Include API routers (v1) ---
    backend_app.include_router(api_router)

    return backend_app


# Load application settings (ENV, DB, host, port, etc.)
settings = get_settings()

# Configure logging
setup_logging()

# Main FastAPI application instance
app = _create_fastapi_backend(settings)


if __name__ == "__main__":
    # Local development run.
    # In production it's better to use:
    #   uvicorn app.backend.main:app --host 0.0.0.0 --port 8000
    uvicorn.run(
        "app.backend.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        workers=settings.SERVER_WORKERS,
        log_level=settings.LOGGING_LEVEL,
    )
