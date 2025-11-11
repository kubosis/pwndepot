from app.backend.schema.base import BaseSchemaModel


class TokenResponse(BaseSchemaModel):
    access_token: str
    token_type: str = "bearer"
