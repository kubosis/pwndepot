from app.backend.schema.base import BaseSchemaModel


class CTFStartRequest(BaseSchemaModel):
    duration_seconds: int
