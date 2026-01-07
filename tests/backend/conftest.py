# ruff: noqa: E402

import asyncio
import os
import sys
from collections.abc import AsyncGenerator
from contextlib import suppress
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.backend.api.v1 import deps
from app.backend.db.base import Base
from app.backend.main import app

with suppress(Exception):
    app.state.limiter.enabled = False

os.environ.setdefault("ENV", "dev")
os.environ.setdefault("DOCS_URL", "/docs")
os.environ.setdefault("OPENAPI_URL", "/openapi.json")
os.environ.setdefault("REDOC_URL", "/redoc")
os.environ.setdefault("SQLALCHEMY_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "1000")
os.environ.setdefault("SERVER_HOST", "127.0.0.1")
os.environ.setdefault("SERVER_PORT", "8000")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("SECRET_KEY", "test_secret_key_that_is_long_enough_32")  # gitleaks:allow
os.environ.setdefault("HASHING_PEPPER", "test_pepper_value_1234567890")
os.environ.setdefault("SERVER_WORKERS", "1")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")
os.environ.setdefault("FRONTEND_DOMAIN", "http://localhost:5173")

TEST_DB_URL = os.environ["SQLALCHEMY_DATABASE_URL"]


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(TEST_DB_URL, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def reset_db(async_engine):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db_session(async_engine) -> AsyncGenerator:
    SessionLocal = async_sessionmaker(bind=async_engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[deps.get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as ac:
        yield ac
    app.dependency_overrides.clear()
