from fastapi import APIRouter

from app.backend.api.v1.endpoints.challenges import router as challenges_router
from app.backend.api.v1.endpoints.teams import router as teams_router
from app.backend.api.v1.endpoints.users import router as users_router
from app.backend.api.v1.endpoints.utils import router as utils_router
from app.backend.config.settings import get_settings

settings = get_settings()

api_router = APIRouter(prefix=f"/{settings.API_PREFIX}", tags=["APIv1"])
api_router.include_router(users_router, prefix="/users")
api_router.include_router(teams_router, prefix="/teams")
api_router.include_router(utils_router, prefix="/utils")
api_router.include_router(challenges_router, prefix="/challenges")
