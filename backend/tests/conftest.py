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
from app.core.rate_limit import limiter  # noqa: E402
limiter.enabled = False


# ── Shared fixtures (app import must happen after env overrides) ──

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.core.utils import utcnow  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402


# The standard account every test starts from. It is inserted straight into the
# database: self-registration is closed by default (``REGISTRATION_MODE=closed``),
# so tests may not depend on ``POST /api/v1/auth/register`` to obtain an account.
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "SecretPass123"
TEST_ADMIN_EMAIL = "admin@example.com"
# Every page the UI knows about. The standard account is deliberately
# unrestricted so page-access tests can use a restricted account of their own
# instead of every other test having to grant itself access.
ALL_PAGES = '["dashboard", "profile", "camera"]'


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


async def seed_account(
    db_session: AsyncSession,
    email: str = TEST_USER_EMAIL,
    password: str = TEST_USER_PASSWORD,
    *,
    name: str = "Test User",
    role: str = "user",
    is_active: bool = True,
    status: str | None = None,
    accessible_pages: str | None = ALL_PAGES,
    **extra: object,
) -> User:
    """Insert an account directly, bypassing the API.

    Accounts are written through the model itself so a test can pick any
    combination of role, status and page access — including states the API
    refuses to produce, such as ``status="pending"``. Self-registration is closed
    by default, so this is how tests obtain an account at all.

    ``email_verified_at`` defaults to "now": the migration backfills every
    pre-existing row the same way, so a seeded account mirrors a real legacy
    account. Pass ``email_verified_at=None`` for an unverified one.
    """
    extra.setdefault("email_verified_at", utcnow())
    user = User(
        email=email.lower(),
        hashed_password=get_password_hash(password),
        name=name,
        role=role,
        is_active=is_active,
        status=status,
        accessible_pages=accessible_pages,
        **extra,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def make_user(db_session):
    """Return an async factory around :func:`seed_account` for the shared session."""
    async def _make_user(
        email: str = TEST_USER_EMAIL,
        password: str = TEST_USER_PASSWORD,
        **kwargs: object,
    ) -> User:
        return await seed_account(db_session, email, password, **kwargs)

    return _make_user


@pytest.fixture
async def registered_user(make_user):
    """The standard account, with the shape the old register response had."""
    user = await make_user()
    return {"result": "success", "data": {"user_id": user.id, "email": user.email}}


async def _login(client: AsyncClient, email: str, password: str) -> dict:
    """Log in and return the response body, with CSRF ready for mutations.

    Cookie-authenticated writes are protected by a double-submit token, so the
    client has to send the same value the backend stored in `csrf_token`.
    """
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})

    token = client.cookies.get("csrf_token")
    if not token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token

    return resp.json()


@pytest.fixture
async def logged_in_user(client, registered_user):
    """Log the standard (non-admin) account in."""
    return await _login(client, TEST_USER_EMAIL, TEST_USER_PASSWORD)


@pytest.fixture
async def logged_in_admin_user(client, make_user):
    """Log in an admin, for every endpoint that requires the admin role."""
    await make_user(email=TEST_ADMIN_EMAIL, name="Test Admin", role="admin")
    return await _login(client, TEST_ADMIN_EMAIL, TEST_USER_PASSWORD)
