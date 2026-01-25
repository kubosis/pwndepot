from __future__ import annotations

from functools import lru_cache

import geoip2.database
from fastapi import Request

from app.backend.config.settings import get_settings


@lru_cache(maxsize=1)
def _reader() -> geoip2.database.Reader:
    settings = get_settings()
    return geoip2.database.Reader(str(settings.GEOIP_DB_PATH))


def geoip_country_code(ip: str) -> str | None:
    try:
        resp = _reader().country(ip)
        return resp.country.iso_code  # "PL or CZ, etc."
    except Exception:
        return None


def client_ip(request: Request) -> str | None:
    # 1) X-Forwarded-For: "client, proxy1, proxy2"
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first

    # 2) X-Real-Ip
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()

    # 3) fallback
    return request.client.host if request.client else None


# ISO 3166-1 alpha-2 (PL, DE, US, etc.)
def resolve_country(request: Request) -> str | None:
    """
    Resolve country code from trusted headers.
    Priority order matches real-world setups.
    """

    # 1) Cloudflare
    cf_country = request.headers.get("cf-ipcountry")
    if cf_country and cf_country != "XX":
        return cf_country.upper()

    # 2) Reverse proxy custom
    for h in ("x-geo-country", "x-forwarded-country"):
        v = request.headers.get(h)
        if v:
            return v.upper()

    ip = client_ip(request)
    if not ip:
        return None
    return geoip_country_code(ip)
