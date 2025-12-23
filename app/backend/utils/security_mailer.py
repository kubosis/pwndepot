from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path

from loguru import logger

from app.backend.config.settings import get_settings
from app.backend.db.models import RoleEnum
from app.backend.security.security_events import SecurityEventType
from app.backend.utils.mail_template import (
    backup_code_used_email_html,
    mfa_reset_email_html,
    new_device_login_email_html,
)
from app.backend.utils.mailer import send_email

settings = get_settings()
LOGO_PATH = Path("/project/assets/pwndepot_standard.png")


async def send_security_email(*, user, event: SecurityEventType, meta: dict) -> bool:
    msg = EmailMessage()
    msg["From"] = settings.MAIL_FROM
    msg["To"] = user.email

    # -----------------------------
    # SUBJECT + TEMPLATE SELECTION
    # -----------------------------
    if event == SecurityEventType.LOGIN_BACKUP_CODE:
        if user.role == RoleEnum.ADMIN:
            subject = "[ADMIN] Backup code used to access your PwnDepot account"
        else:
            subject = "Backup code used to access your PwnDepot account"

        html_builder = backup_code_used_email_html

    elif event == SecurityEventType.MFA_RESET:
        subject = "Two-factor authentication was disabled"
        html_builder = mfa_reset_email_html

    elif event == SecurityEventType.LOGIN_NEW_DEVICE:
        if user.role == RoleEnum.ADMIN:
            subject = "New ADMIN login from a new device"
        else:
            subject = "New sign-in to your PwnDepot account"

        html_builder = new_device_login_email_html

    else:
        logger.warning(f"Unhandled security event: {event}")
        return False

    msg["Subject"] = subject

    # -----------------------------
    # TEXT FALLBACK (ANTI-SPAM)
    # -----------------------------
    msg.set_content(
        f"""
Security notification for {user.username}

Event: {event}
IP address: {meta.get("ip")}
User-Agent: {meta.get("user_agent")}
Time: {meta.get("time")}
"""
    )

    # -----------------------------
    # HTML PART
    # -----------------------------
    logo_cid = make_msgid(domain="pwndepot.local")
    logo_cid_no_brackets = logo_cid[1:-1]

    kwargs = {
        "username": user.username,
        "ip": meta.get("ip"),
        "country": meta.get("country"),
        "user_agent": meta.get("user_agent"),
        "time": str(meta.get("time")),
        "logo_cid": logo_cid_no_brackets,
    }

    if html_builder in (
        new_device_login_email_html,
        backup_code_used_email_html,
    ):
        kwargs["is_admin"] = user.role == RoleEnum.ADMIN

    html = html_builder(**kwargs)

    msg.add_alternative(html, subtype="html")

    # -----------------------------
    # INLINE LOGO (CID)
    # -----------------------------
    if LOGO_PATH.exists():
        with open(LOGO_PATH, "rb") as img:
            msg.get_payload()[1].add_related(
                img.read(),
                maintype="image",
                subtype="png",
                cid=logo_cid,
                disposition="inline",
                filename="pwndepot.png",
            )
    else:
        logger.warning(f"Logo not found: {LOGO_PATH}")

    return send_email(msg)
