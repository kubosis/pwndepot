from fastapi import Response

from app.backend.config.settings import get_settings

settings = get_settings()


def clear_auth_cookies(response: Response) -> None:
    """
    Clear auth cookies robustly:
    - with configured domain (prod)
    - without domain (host-only, common in dev)
    """
    # access token
    response.delete_cookie("access_token", path="/", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie("access_token", path="/")  # host-only fallback

    # refresh token (path must match set_cookie)
    refresh_path = "/api/v1/users/auth/refresh"
    response.delete_cookie("refresh_token", path=refresh_path, domain=settings.COOKIE_DOMAIN)
    response.delete_cookie("refresh_token", path=refresh_path)  # host-only fallback
