import secrets
import string


def generate_backup_codes(count: int = 10) -> list[str]:
    alphabet = string.ascii_uppercase + string.digits
    codes = []

    for _ in range(count):
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{raw[:4]}-{raw[4:]}")

    return codes
