# app/backend/schema/validators/password.py
import re


def validate_strong_password(v: str) -> str:
    # length (DoS protection)
    if len(v) < 12 or len(v) > 128:
        raise ValueError("Password must be 12-128 characters long.")

    # min 1 big letter
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least 1 uppercase letter.")

    # min 1 digit
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least 1 number.")

    # min 1 special char
    if not re.search(r"[^a-zA-Z0-9]", v):
        raise ValueError("Password must contain at least 1 special character.")

    return v
