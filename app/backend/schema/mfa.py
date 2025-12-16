from app.backend.schema.base import BaseSchemaModel


class MfaSetupResponse(BaseSchemaModel):
    secret: str
    otpauth_url: str


class MfaEnableRequest(BaseSchemaModel):
    secret: str
    code: str


class MfaVerifyRequest(BaseSchemaModel):
    code: str
