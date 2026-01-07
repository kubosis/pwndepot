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

import os

# -----------------------------
# ENV / MODE
# -----------------------------
os.environ.setdefault("ENV", "dev")

# -----------------------------
# API / DOCS
# -----------------------------
os.environ.setdefault("DOCS_URL", "/docs")
os.environ.setdefault("OPENAPI_URL", "/openapi.json")
os.environ.setdefault("REDOC_URL", "/redoc")
os.environ.setdefault("API_VERSION", "v1")

# -----------------------------
# DATABASE (SQLite for tests)
# -----------------------------
os.environ.setdefault(
    "SQLALCHEMY_SQLLITE_ASYNC_URL",
    "sqlite+aiosqlite:///./test.db",
)
os.environ.setdefault(
    "SQLALCHEMY_SQLLITE_SYNC_URL",
    "sqlite:///./test.db",
)

# -----------------------------
# RATE LIMITING
# -----------------------------
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "1000")

# -----------------------------
# SERVER (UVICORN)
# -----------------------------
os.environ.setdefault("UVICORN_SERVER_HOST", "127.0.0.1")
os.environ.setdefault("UVICORN_SERVER_PORT", "8000")
os.environ.setdefault("SERVER_WORKERS", "1")

# -----------------------------
# SECURITY / JWT
# -----------------------------
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test_jwt_secret_key_that_is_long_enough_32_chars",  # gitleaks:allow
)
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault(
    "JWT_HASHING_PEPPER",
    "test_pepper_value_1234567890",
)

os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("MFA_TOKEN_EXPIRATION_MINS", "2")

# -----------------------------
# CORS / FRONTEND
# -----------------------------
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")
os.environ.setdefault("FRONTEND_DOMAIN", "http://localhost:5173")

# -----------------------------
# TRUSTED PROXIES
# -----------------------------
os.environ.setdefault("TRUSTED_PROXY_IPS", "")

# -----------------------------
# SMTP / EMAIL (dummy but required)
# -----------------------------
os.environ.setdefault("SMTP_HOST", "localhost")
os.environ.setdefault("SMTP_PORT", "587")
os.environ.setdefault("SMTP_USE_TLS", "false")
os.environ.setdefault("SMTP_USERNAME", "test")
os.environ.setdefault("SMTP_PASSWORD", "test")
os.environ.setdefault("MAIL_FROM", "test@localhost")
os.environ.setdefault("CONTACT_RECEIVER_EMAIL", "admin@localhost")


TEST_DB_URL = os.environ["SQLALCHEMY_DATABASE_URL"]


from app.backend.api.v1 import deps
from app.backend.db.base import Base
from app.backend.main import app

with suppress(Exception):
    app.state.limiter.enabled = False

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
