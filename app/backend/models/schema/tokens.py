from app.backend.models.schema.base import BaseSchemaModel


class TokenResponse(BaseSchemaModel):
    access_token: str
    token_type: str = "bearer"
