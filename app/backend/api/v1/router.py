from app.backend.api.v1.endpoints import ctf_events
from app.backend.api.v1.endpoints.challenges import router as challenges_router
from app.backend.api.v1.endpoints.contact import router as contact_router
from app.backend.api.v1.endpoints.ctf import router as ctf_router
from app.backend.api.v1.endpoints.mfa import router as mfa_router
from app.backend.api.v1.endpoints.teams import router as teams_router
from app.backend.api.v1.endpoints.users import router as users_router
from app.backend.config.settings import get_settings
from fastapi import APIRouter

settings = get_settings()

api_router = APIRouter(prefix=f"/{settings.API_PREFIX}", tags=["APIv1"])
api_router.include_router(users_router, prefix="/users")
api_router.include_router(teams_router, prefix="/teams")
api_router.include_router(contact_router, prefix="/contact")
api_router.include_router(challenges_router, prefix="/challenges")
api_router.include_router(mfa_router, prefix="/mfa")
api_router.include_router(ctf_router)
api_router.include_router(ctf_events.router)
