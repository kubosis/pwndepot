from pydantic import constr

from app.backend.schema.base import BaseSchemaModel


class MfaSetupResponse(BaseSchemaModel):
    secret: str
    otpauth_url: str


class MfaEnableRequest(BaseSchemaModel):
    secret: constr(min_length=16, max_length=128)
    code: constr(min_length=6, max_length=16)


class MfaVerifyRequest(BaseSchemaModel):
    code: constr(min_length=6, max_length=16)


class MfaResetRequest(BaseSchemaModel):
    password: constr(min_length=12, max_length=128)
