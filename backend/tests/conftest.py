"""
Pytest configuration and shared fixtures for ART Workspace backend tests.
"""
import os

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Override environment variables before importing app modules
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "7")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

# Disable SlowAPI rate limiter during test suite execution
from app.core.rate_limit import limiter
limiter.enabled = False


# ── Shared fixtures (app import must happen after env overrides) ──

from app.core.database import Base, get_db
from app.main import app


@pytest.fixture
async def db_session():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def client(db_session):
    """Create an AsyncClient with overridden DB dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver.local") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def registered_user(client):
    """Register a user and return the response data."""
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "SecretPass123",
        "name": "Test User",
    })
    return resp.json()


@pytest.fixture
async def logged_in_user(client, registered_user):
    """Login, then echo the CSRF cookie so authenticated mutations pass.

    Cookie-authenticated writes are protected by a double-submit token, so the
    client has to send the same value the backend stored in `csrf_token`.
    """
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "SecretPass123",
    })

    token = client.cookies.get("csrf_token")
    if not token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token

    return resp.json()
