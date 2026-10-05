"""API endpoint tests for ART Workspace backend."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import Base, get_db
from app.main import app

# Mark all tests in this file as asyncio tests
pytestmark = pytest.mark.asyncio

# ── Fixtures ──────────────────────────────────────────────

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


# ── CSRF Protection Tests ─────────────────────────────────

class TestCSRFProtection:
    async def test_csrf_endpoint_issues_matching_cookie(self, client):
        resp = await client.get("/api/v1/auth/csrf")
        assert resp.status_code == 200
        token = resp.json()["data"]["csrf_token"]
        assert token
        assert client.cookies.get("csrf_token") == token

    async def test_authenticated_write_without_header_is_rejected(
        self, client, logged_in_user
    ):
        del client.headers["X-CSRF-Token"]
        resp = await client.post(
            "/api/v1/profile/dashboard-layout",
            json={"dashboard_layout": "[]"},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "csrf_failed"

    async def test_authenticated_write_with_header_succeeds(
        self, client, logged_in_user
    ):
        resp = await client.post(
            "/api/v1/profile/dashboard-layout",
            json={"dashboard_layout": "[]"},
        )
        assert resp.status_code == 200
        assert resp.json()["result"] == "success"

    async def test_anonymous_write_keeps_its_normal_auth_error(self, client):
        """Anonymous writes must not be turned into CSRF failures."""
        resp = await client.post(
            "/api/v1/profile/dashboard-layout",
            json={"dashboard_layout": "[]"},
        )
        assert resp.status_code in [401, 403]
        if resp.status_code == 403:
            assert resp.json().get("code") != "csrf_failed"


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

    async def test_update_dashboard_layout(self, client, logged_in_user):
        layout_data = '[{"id":"oilprice","w":1},{"id":"qrcode","w":1}]'
        resp = await client.post(
            "/api/v1/profile/dashboard-layout",
            json={"dashboard_layout": layout_data}
        )
        assert resp.status_code == 200
        assert resp.json()["result"] == "success"

        # Verify through profile/me
        me_resp = await client.get("/api/v1/profile/me")
        assert me_resp.status_code == 200
        assert me_resp.json()["dashboard_layout"] == layout_data

    async def test_update_camera_config(self, client, logged_in_user):
        camera_data = '[{"id":"cam-1","name":"Front Door","location":"Entrance","streamType":"simulated"}]'
        resp = await client.post(
            "/api/v1/profile/camera-config",
            json={"camera_config": camera_data}
        )
        assert resp.status_code == 200
        assert resp.json()["result"] == "success"

        # Verify through profile/me
        me_resp = await client.get("/api/v1/profile/me")
        assert me_resp.status_code == 200
        assert me_resp.json()["camera_config"] == camera_data


# ── WebSocket Broadcast Tests ─────────────────────────────

BROADCAST_PAYLOAD = {
    "id": "n-1",
    "type": "system",
    "level": "warning",
    "title": "แจ้งเตือน",
    "body": "ทดสอบ",
}


@pytest.fixture
async def admin_client(client, db_session, registered_user):
    """Promote the registered user to admin, then log in again."""
    from app.services.user_service import UserService

    user = await UserService(db_session).get_user_by_email("test@example.com")
    assert user is not None
    user.role = "admin"
    await db_session.commit()

    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "SecretPass123",
    })
    assert resp.status_code == 200, resp.text
    token = client.cookies.get("csrf_token")
    if not token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    return client


class TestWebsocketBroadcast:
    async def test_anonymous_broadcast_is_rejected(self, client):
        """Regression: the broadcast endpoint must never be reachable anonymously."""
        resp = await client.post("/api/v1/ws/broadcast", json=BROADCAST_PAYLOAD)
        assert resp.status_code in (401, 403)
        assert resp.status_code != 200

    async def test_non_admin_broadcast_is_forbidden(self, client, logged_in_user):
        """An authenticated but non-admin user must be rejected with 403."""
        assert logged_in_user["data"]["user"]["role"] == "user"
        resp = await client.post("/api/v1/ws/broadcast", json=BROADCAST_PAYLOAD)
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Not enough permissions"

    async def test_admin_broadcast_succeeds(self, admin_client):
        resp = await admin_client.post("/api/v1/ws/broadcast", json=BROADCAST_PAYLOAD)
        assert resp.status_code == 200, resp.text
        assert resp.json()["message"] == "Broadcast sent"
        assert resp.json()["payload"] == BROADCAST_PAYLOAD

    async def test_admin_broadcast_rejects_malformed_payload(self, admin_client):
        resp = await admin_client.post("/api/v1/ws/broadcast", json={"id": "n-1"})
        assert resp.status_code == 422


# ── Public proxy rate limiting ────────────────────────────
# weather/ and oil-prices/ are unauthenticated by design (the login screen
# renders the widgets), which makes them open relays to third-party providers.
# These tests confirm the general rate limit now bounds that.

@pytest.fixture
def limited_client(client):
    """Enable the limiter and shrink the stored limits for these routes.

    SlowAPI resolves ``@limiter.limit("N/minute")`` at import time and stores a
    Limit object per route, so mutating settings after import has no effect —
    the registered Limit objects themselves must be patched.
    """
    from limits import parse_many
    from app.core.rate_limit import limiter

    limiter.enabled = True
    limiter.reset()

    shrunk = parse_many("5 per 1 minute")[0]
    route_limits = limiter._route_limits
    touched = []
    for name, limits in route_limits.items():
        for limit_obj in limits:
            touched.append((limit_obj, limit_obj.limit))
            limit_obj.limit = shrunk
    try:
        yield client
    finally:
        for limit_obj, original in touched:
            limit_obj.limit = original
        limiter.reset()
        limiter.enabled = False


class TestPublicProxyRateLimit:
    async def test_weather_forecast_is_rate_limited(self, limited_client):
        codes = []
        for i in range(9):
            resp = await limited_client.get(
                "/api/v1/weather/forecast",
                params={"latitude": 13.75 + i * 0.01, "longitude": 100.5},
            )
            codes.append(resp.status_code)
        assert 429 in codes, f"rate limit never engaged: {codes}"

    async def test_oil_prices_is_rate_limited(self, limited_client):
        codes = []
        for _ in range(9):
            resp = await limited_client.get("/api/v1/oil-prices/oil-prices")
            codes.append(resp.status_code)
        assert 429 in codes, f"rate limit never engaged: {codes}"

    async def test_limit_returns_429_not_500(self, limited_client):
        """A throttled request must be a clean 429, never an unhandled error."""
        for _ in range(9):
            resp = await limited_client.get("/api/v1/oil-prices/oil-prices")
        assert resp.status_code == 429
        assert resp.status_code < 500


class TestWeatherCacheBounds:
    """The weather caches are keyed by user-supplied coordinates, so they need a
    hard cap or a long-lived process grows them without bound."""

    def test_cache_purges_and_caps_entries(self):
        from app.api.v1.endpoints.weather import (
            MAX_CACHE_ENTRIES, _WEATHER_CACHE, _cache_set,
        )

        _WEATHER_CACHE.clear()
        try:
            for i in range(MAX_CACHE_ENTRIES + 50):
                _cache_set(_WEATHER_CACHE, (13.0 + i * 0.001, 100.0, 2), {"i": i})
            assert len(_WEATHER_CACHE) <= MAX_CACHE_ENTRIES
        finally:
            _WEATHER_CACHE.clear()

    def test_expired_entries_are_dropped_before_evicting_fresh_ones(self):
        from app.api.v1.endpoints.weather import (
            MAX_CACHE_ENTRIES, _WEATHER_CACHE, _cache_set,
        )
        from app.core.utils import utcnow

        _WEATHER_CACHE.clear()
        try:
            import datetime as _dt

            # Fill the cache entirely with entries whose TTL has already passed.
            for i in range(MAX_CACHE_ENTRIES):
                _WEATHER_CACHE[("stale", i, 1)] = {
                    "ts": utcnow() - _dt.timedelta(days=2),
                    "data": {"i": i},
                }
            assert len(_WEATHER_CACHE) == MAX_CACHE_ENTRIES

            # One new insert must purge the expired rows rather than grow past
            # the cap — and the fresh entry it stores must be readable.
            _cache_set(_WEATHER_CACHE, ("fresh", 0.0, 1), {"fresh": True})

            assert len(_WEATHER_CACHE) <= MAX_CACHE_ENTRIES
            assert not [k for k in _WEATHER_CACHE if k[0] == "stale"]
            assert _WEATHER_CACHE[("fresh", 0.0, 1)]["data"] == {"fresh": True}
        finally:
            _WEATHER_CACHE.clear()

    def test_cache_get_respects_ttl(self):
        from app.api.v1.endpoints.weather import _WEATHER_CACHE, _cache_get, _cache_set
        from app.core.utils import utcnow
        import datetime

        _WEATHER_CACHE.clear()
        try:
            _cache_set(_WEATHER_CACHE, ("k", 0.0, 1), {"v": 1})
            assert _cache_get(_WEATHER_CACHE, ("k", 0.0, 1), 600) == {"v": 1}

            _WEATHER_CACHE[("k", 0.0, 1)]["ts"] = utcnow() - datetime.timedelta(hours=2)
            assert _cache_get(_WEATHER_CACHE, ("k", 0.0, 1), 600) is None
        finally:
            _WEATHER_CACHE.clear()
