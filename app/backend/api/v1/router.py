from fastapi import APIRouter

from app.backend.api.v1.endpoints.users import router
from app.backend.config.settings import get_settings

settings = get_settings()

api_router = APIRouter(prefix=f"/{settings.API_PREFIX}", tags=["APIv1"])
api_router.include_router(router, prefix="/users")
