from fastapi import Request


# ISO 3166-1 alpha-2 (PL, DE, US, etc.)
def resolve_country(request: Request) -> str | None:
    """
    Resolve country code from trusted headers.
    Priority order matches real-world setups.
    """

    # Cloudflare
    cf_country = request.headers.get("cf-ipcountry")
    if cf_country and cf_country != "XX":
        return cf_country.upper()

    # Generic reverse proxies
    x_country = request.headers.get("x-geo-country")
    if x_country:
        return x_country.upper()

    # Nginx / ingress custom
    x_forwarded_country = request.headers.get("x-forwarded-country")
    if x_forwarded_country:
        return x_forwarded_country.upper()

    # Nothing known
    return None
