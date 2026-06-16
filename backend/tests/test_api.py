"""
API endpoint tests for ART Workspace backend.
Uses httpx.AsyncClient with in-memory SQLite (aiosqlite) for async testing.
"""
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import Base, get_db
from app.main import app
from app.schemas.user import UserCreate

# Mark all tests in this file as asyncio tests
pytestmark = pytest.mark.asyncio

# ── Fixtures ──────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


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
    """Login and return the response data with tokens."""
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "SecretPass123",
    })
    return resp.json()


# ── Health Check Tests ────────────────────────────────────

class TestHealthCheck:
    async def test_root_endpoint(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "ART Workspace API"
        assert data["status"] == "running"

    async def test_health_endpoint(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"


# ── Auth API Tests ────────────────────────────────────────

class TestAuthAPI:
    async def test_register_success(self, client):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "new@example.com",
            "password": "NewPass123",
            "name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["result"] == "success"

    async def test_register_duplicate_email(self, client, registered_user):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "test@example.com",
            "password": "AnotherPass",
            "name": "Another User",
        })
        assert resp.status_code == 400

    async def test_login_success(self, client, registered_user):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "SecretPass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["result"] == "success"
        # Access token and refresh token are set in cookies
        assert "access_token" in client.cookies
        assert "refresh_token" in client.cookies
        assert data["data"]["user"]["email"] == "test@example.com"

    async def test_login_wrong_password(self, client, registered_user):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_email(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "Whatever",
        })
        assert resp.status_code == 401

    async def test_login_inactive_user(self, client, registered_user, db_session):
        from app.models.user import User
        from sqlalchemy import select
        res = await db_session.execute(select(User).filter(User.email == "test@example.com"))
        user = res.scalar_one_or_none()
        user.is_active = False
        await db_session.commit()

        resp = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "SecretPass123",
        })
        assert resp.status_code == 403

    async def test_refresh_token_success(self, client, logged_in_user):
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["result"] == "success"

    async def test_refresh_token_invalid(self, client):
        # We temporarily clear client cookies to send invalid refresh token
        client.cookies.clear()
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.token"})
        assert resp.status_code == 401

    async def test_logout_success(self, client, logged_in_user):
        session_id = logged_in_user["data"]["session_id"]
        resp = await client.post("/api/v1/auth/logout", params={"session_id": session_id})
        assert resp.status_code == 200
        data = resp.json()
        assert data["result"] == "success"


# ── Profile API Tests ─────────────────────────────────────

class TestProfileAPI:
    async def test_get_profile(self, client, logged_in_user):
        resp = await client.get("/api/v1/profile/me")
        assert resp.status_code == 200

    async def test_get_profile_unauthorized(self, client):
        resp = await client.get("/api/v1/profile/me")
        assert resp.status_code in [401, 403]