import datetime

import pydantic

from app.backend.utils.formatters import format_datetime_into_isoformat


class BaseSchemaModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        populate_by_name=True,
    )

    @pydantic.field_serializer("*", mode="wrap", when_used="json")
    def serialize_datetime(self, value, handler, info):
        if isinstance(value, datetime.datetime):
            return format_datetime_into_isoformat(value)
        return handler(value)
