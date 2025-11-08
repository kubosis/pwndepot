from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.backend.config.settings import get_settings

settings = get_settings()

async_engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URL)

AsyncSessionLocal = async_sessionmaker(bind=async_engine, expire_on_commit=False, class_=AsyncSession)
