# app/backend/utils/limiter.py
from __future__ import annotations

import functools
import inspect
from collections.abc import Callable
from typing import Any, TypeVar, cast, get_type_hints

from slowapi import Limiter
from starlette.requests import Request

from app.backend.config.settings import get_settings

settings = get_settings()
F = TypeVar("F", bound=Callable[..., Any])


def client_ip_key(request: Request) -> str:
    # request.client.host will be correct if behind trusted proxy middleware
    return request.client.host if request.client else "unknown"


limiter = Limiter(
    key_func=client_ip_key,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
    storage_uri=settings.REDIS_URL,
)


def rate_limit(*dargs: Any, **dkwargs: Any) -> Callable[[F], F]:
    slowapi_decorator = limiter.limit(*dargs, **dkwargs)

    def _decorator(func: F) -> F:
        limited = slowapi_decorator(func)

        @functools.wraps(func)
        async def _wrapped(*args: Any, **kwargs: Any) -> Any:
            return await limited(*args, **kwargs)

        # Keep FastAPI signature
        _wrapped.__signature__ = inspect.signature(func)  # type: ignore[attr-defined]

        # CRITICAL: resolve string annotations using ORIGINAL func globals
        _wrapped.__annotations__ = get_type_hints(func, globalns=func.__globals__, include_extras=True)

        return cast(F, _wrapped)

    return _decorator
