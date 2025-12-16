from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.db.session import AsyncSessionLocal
from app.backend.repository.contact import save_contact_message
from app.backend.schema.contact import ContactRequest
from app.backend.utils.limiter import limiter
from app.backend.utils.mail import send_contact_email

router = APIRouter(tags=["contact"])


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as db:
        yield db


@router.post("", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def contact(
    request: Request,
    data: ContactRequest,
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Contact form submitted: domain={data.email.split('@')[-1]}")

    try:
        saved = await save_contact_message(db, data)

        email_sent = False

        if saved:
            email_sent = send_contact_email(
                name=data.name,
                email=data.email,
                message=data.message,
            )
        else:
            logger.warning(f"Duplicate contact message: {data.email}")

        if email_sent:
            return {
                "success": True,
                "message": "Message has been sent successfully",
            }

        return {
            "success": False,
            "message": "Message send failed, but your message has been saved",
        }

    except Exception as err:
        logger.exception("Contact form processing failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something went wrong",
        ) from err
