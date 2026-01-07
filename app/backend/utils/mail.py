from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path

from loguru import logger

from app.backend.config.settings import get_settings
from app.backend.utils.mail_template import reset_password_email_html, verification_email_html
from app.backend.utils.mailer import send_email

settings = get_settings()

# -----------------------------
# PATH TO LOGO
# -----------------------------
LOGO_PATH = Path("/project/assets/pwndepot_standard.png")


# -----------------------------
# CONTACT EMAIL
# -----------------------------
def send_contact_email(*, name: str, email: str, message: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = f"[CONTACT] Message from {name}"
    msg["From"] = settings.MAIL_FROM
    msg["To"] = settings.CONTACT_RECEIVER_EMAIL
    msg["Reply-To"] = email

    msg.set_content(
        f"""New contact message:

Name: {name}
Email: {email}

Message:
{message}
"""
    )

    return send_email(msg)


# -----------------------------
# VERIFICATION EMAIL (HTML + CID)
# -----------------------------
def send_verification_email(email: str, token: str) -> bool:
    verify_url = f"{settings.FRONTEND_DOMAIN}/verify-email?token={token}"

    msg = EmailMessage()
    msg["Subject"] = "Verify your email address"
    msg["From"] = settings.MAIL_FROM
    msg["To"] = email

    msg.set_content(
        f"""Please verify your email address by clicking the link below:

{verify_url}

This link expires in 24 hours.
If you didn't create an account, you can safely ignore this email.
"""
    )

    # --- generate proper CID ---
    logo_cid = make_msgid(domain="pwndepot.local")  # returns like "<xxxx@pwndepot.local>"
    logo_cid_no_brackets = logo_cid[1:-1]  # "xxxx@pwndepot.local"

    # HTML with correct cid reference
    msg.add_alternative(
        verification_email_html(verify_url, logo_cid=logo_cid_no_brackets),
        subtype="html",
    )

    # Attach inline image to the HTML part (payload[1])
    if LOGO_PATH.exists():
        with open(LOGO_PATH, "rb") as img:
            msg.get_payload()[1].add_related(
                img.read(),
                maintype="image",
                subtype="png",
                cid=logo_cid,  # IMPORTANT: pass with < >
                disposition="inline",
                filename="pwndepot.png",  # helps some clients
            )
        logger.info(f"Inline logo attached with CID={logo_cid}")
    else:
        logger.warning(f"Logo not found: {LOGO_PATH}")

    return send_email(msg)


def send_reset_password_email(email: str, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_DOMAIN}/reset-password?token={token}"

    msg = EmailMessage()
    msg["Subject"] = "Reset your password"
    msg["From"] = settings.MAIL_FROM
    msg["To"] = email

    msg.set_content(
        f"""A password reset was requested.

Reset your password using this link:
{reset_url}

This link expires in 1 hour.
If you did not request this, ignore this email.
"""
    )

    logo_cid = make_msgid(domain="pwndepot.local")
    logo_cid_no_brackets = logo_cid[1:-1]

    msg.add_alternative(
        reset_password_email_html(reset_url, logo_cid_no_brackets),
        subtype="html",
    )

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

    return send_email(msg)
