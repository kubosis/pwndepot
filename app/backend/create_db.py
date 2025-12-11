import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from app.backend.config.settings import get_settings

# Import Base and ALL models so SQLAlchemy knows them
from app.backend.db.base import Base
from app.backend.db import models


async def init_db():
    settings = get_settings()
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        print("Creating all database tables...")
        await conn.run_sync(Base.metadata.drop_all)   # optional for dev
        await conn.run_sync(Base.metadata.create_all)
        print("Database created successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
