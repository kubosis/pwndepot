from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.backend.config.settings import get_settings
from app.backend.db.models import RoleEnum, UserTable
from app.backend.db.session import AsyncSessionLocal
from app.backend.repository.ctf_state import CTFStateRepository

settings = get_settings()


class CTFGateMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        allowlist_exact: set[str] | None = None,
        allowlist_prefixes: Iterable[str] = (),
    ):
        super().__init__(app)
        self.allowlist_exact = allowlist_exact or set()
        self.allowlist_prefixes = tuple(allowlist_prefixes)

    def _is_allowlisted(self, request: Request) -> bool:
        """
        Decide if the request is allowed even when the CTF is closed.
        """
        path = request.url.path

        if path in self.allowlist_exact:
            return True

        for pfx in self.allowlist_prefixes:
            if path.startswith(pfx):
                return True

        return path == "/api/v1/users/admin/login"

    async def _is_admin_session(self, request: Request) -> bool:
        """
        True only if request has a valid access_token cookie AND that user is admin.
        (Used to allow admin endpoints even when CTF is closed.)
        """
        token = request.cookies.get("access_token")
        if not token:
            return False

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_id = int(payload.get("sub"))
        except Exception:
            return False

        async with AsyncSessionLocal() as session:
            user = await session.get(UserTable, user_id)

        return bool(user and user.role == RoleEnum.ADMIN)

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1) Always allow explicit allowlist
        if self._is_allowlisted(request):
            return await call_next(request)

        # 2) Read CTF state
        async with AsyncSessionLocal() as session:
            repo = CTFStateRepository(session)
            state = await repo.get_state()

        now = datetime.now(timezone.utc)
        is_open = state.active and (state.ends_at is None or state.ends_at >= now)

        # 3) If CTF is closed -> allow ADMIN session to access everything (except what you explicitly want to block)
        if not is_open:
            if await self._is_admin_session(request):
                return await call_next(request)

            return JSONResponse(
                status_code=403,
                content={
                    "code": "CTF_ENDED",
                    "message": "CTF has ended. Only admin endpoints are available.",
                    "ends_at": state.ends_at.isoformat() if state.ends_at else None,
                },
            )

        # 4) CTF open -> normal
        return await call_next(request)
