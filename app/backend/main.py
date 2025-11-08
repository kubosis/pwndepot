import fastapi
import uvicorn
from fastapi.middleware import cors

from app.backend.api.v1.router import api_router
from app.backend.config.settings import BackendBaseSettings, get_settings
from app.backend.logging_config import setup_logging


def _create_fastapi_backend(app_settings: BackendBaseSettings) -> fastapi.FastAPI:
    backend_app = fastapi.FastAPI(**app_settings.backend_app_attributes)

    backend_app.add_middleware(
        cors.CORSMiddleware,  # type: ignore
        allow_origins=app_settings.ALLOWED_ORIGINS,
        allow_credentials=False,  # We will send  "Authorization": `Bearer ${accessToken}` in headers manually
        allow_methods=app_settings.ALLOWED_METHODS,
        allow_headers=app_settings.ALLOWED_HEADERS,
    )

    backend_app.include_router(api_router)
    return backend_app


settings = get_settings()
setup_logging()
app = _create_fastapi_backend(settings)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        workers=settings.SERVER_WORKERS,
        log_level=settings.LOGGING_LEVEL,
    )
