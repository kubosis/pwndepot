import smtplib
import time
from email.message import EmailMessage
from smtplib import SMTPException

from app.backend.config.settings import get_settings

settings = get_settings()

SMTP_MAX_RETRIES = 3
SMTP_RETRY_DELAY_SECONDS = 2


def send_contact_email(*, name: str, email: str, message: str) -> bool:
    """
    Sends contact form email.
    Returns True if email was sent, False otherwise.
    """

    msg = EmailMessage()
    msg["Subject"] = f"[CONTACT] Message from {name}"
    msg["From"] = settings.MAIL_FROM
    msg["To"] = settings.CONTACT_RECEIVER_EMAIL
    msg["Reply-To"] = email
    msg.set_content(
        f"""
New contact message:

Name: {name}
Email: {email}

Message:
{message}
"""
    )

    for attempt in range(1, SMTP_MAX_RETRIES + 1):
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()

                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

                server.send_message(msg)
                return True

        except (SMTPException, OSError):
            if attempt < SMTP_MAX_RETRIES:
                time.sleep(SMTP_RETRY_DELAY_SECONDS)
            else:
                return False
