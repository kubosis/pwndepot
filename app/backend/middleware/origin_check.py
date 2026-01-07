# app/backend/middleware/origin_check.py
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """
    Minimal CSRF protection for cookie-auth:
    For unsafe methods, require Origin (or Referer) to match allowed origins.
    """

    def __init__(self, app, allowed_origins: list[str], *, enabled: bool = True):
        super().__init__(app)
        self.allowed_origins = set(allowed_origins)
        self.enabled = enabled

    def _origin_ok(self, request: Request) -> bool:
        origin = request.headers.get("origin")
        if origin:
            return origin in self.allowed_origins

        # Some browsers / cases might not send Origin; fallback to Referer
        referer = request.headers.get("referer")
        if referer:
            # allow if referer starts with any allowed origin
            return any(referer.startswith(o) for o in self.allowed_origins)

        # If neither header exists, reject unsafe request (strict mode)
        return False

    async def dispatch(self, request: Request, call_next) -> Response:
        if not self.enabled:
            return await call_next(request)

        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and not self._origin_ok(request):
            # allow docs/health or public endpoints
            return JSONResponse(
                status_code=403,
                content={"code": "CSRF_BLOCKED", "message": "Invalid Origin/Referer."},
            )

        return await call_next(request)
