from pydantic import BaseModel, EmailStr, constr


class ContactRequest(BaseModel):
    name: constr(min_length=1, max_length=80, pattern=r"^[^\r\n]{1,80}$")
    email: EmailStr
    message: constr(min_length=1, max_length=2000)