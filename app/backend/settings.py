import decouple
import pydantic_settings

class BackendBaseSettings(pydantic_settings.BaseSettings):
    # ...
    FRONTEND_URL: str = decouple.config(
        "FRONTEND_URL",
        default="http://localhost:5173",
        cast=str,
    )
    # jeśli masz ALLOWED_ORIGINS w tej klasie i nie używasz – możesz usunąć
