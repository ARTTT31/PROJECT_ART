"""API endpoint tests for ART Workspace backend."""
import json
from contextlib import contextmanager
from urllib.parse import unquote

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.database import Base, get_db
from app.core.utils import decode_user_cookie, encode_user_cookie
from app.main import app
from app.models.audit_log import AuditLog

# No module-level asyncio mark: `pytest.ini` sets `asyncio_mode = auto`, so async
# tests are collected without one — and marking the whole module would also stamp
# the sync Starlette TestClient tests below with an asyncio mark they cannot use.

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


# ── WebSocket subscribe authentication ────────────────────
# The broadcast POST was locked down earlier, but the subscribe side stayed open:
# anyone who knew the URL could hold a socket and receive every broadcast. These
# tests cover the handshake check, the process-level caps, and the real ASGI
# handshake so the regression cannot come back silently.

class _StubWebSocket:
    """Minimal stand-in for the handshake attributes the auth helper reads."""

    def __init__(self, cookies=None, headers=None):
        self.cookies = cookies or {}
        self.headers = headers or {}


@pytest.fixture(autouse=False)
def reset_ws_manager():
    """Keep the module-level connection registry from leaking between tests."""
    from app.api.v1.endpoints.websockets import manager

    yield manager
    manager.active_connections.clear()
    manager._owner.clear()
    manager._per_user.clear()


@pytest.fixture
async def ws_user(db_session):
    """An ordinary active account to authenticate the socket with."""
    from app.schemas.user import UserCreate
    from app.services.user_service import UserService

    return await UserService(db_session).create_user(UserCreate(
        email="ws@example.com", password="SecretPass123", name="WS User"))


def _token_for(user) -> str:
    from app.core.security import create_access_token

    return create_access_token(data={"sub": user.email, "user_id": user.id})


class TestWebsocketAuthentication:
    async def test_anonymous_handshake_is_rejected(self, db_session):
        from app.api.dependencies import authenticate_websocket

        assert await authenticate_websocket(_StubWebSocket(), db_session) is None

    async def test_valid_access_token_cookie_authenticates(self, db_session, ws_user):
        from app.api.dependencies import authenticate_websocket

        socket = _StubWebSocket(cookies={"access_token": _token_for(ws_user)})
        user = await authenticate_websocket(socket, db_session)

        assert user is not None
        assert user.id == ws_user.id

    async def test_bearer_prefix_in_the_cookie_is_tolerated(self, db_session, ws_user):
        from app.api.dependencies import authenticate_websocket

        socket = _StubWebSocket(cookies={"access_token": f"Bearer {_token_for(ws_user)}"})

        assert (await authenticate_websocket(socket, db_session)) is not None

    async def test_bearer_header_authenticates_non_browser_clients(self, db_session, ws_user):
        from app.api.dependencies import authenticate_websocket

        socket = _StubWebSocket(headers={"authorization": f"Bearer {_token_for(ws_user)}"})

        assert (await authenticate_websocket(socket, db_session)) is not None

    async def test_invalid_token_is_rejected(self, db_session):
        from app.api.dependencies import authenticate_websocket

        socket = _StubWebSocket(cookies={"access_token": "not.a.jwt"})

        assert await authenticate_websocket(socket, db_session) is None

    async def test_token_for_a_deleted_user_is_rejected(self, db_session, ws_user):
        from app.api.dependencies import authenticate_websocket

        token = _token_for(ws_user)
        await db_session.delete(ws_user)
        await db_session.commit()

        socket = _StubWebSocket(cookies={"access_token": token})
        assert await authenticate_websocket(socket, db_session) is None

    async def test_inactive_account_is_rejected(self, db_session, ws_user):
        from app.api.dependencies import authenticate_websocket

        token = _token_for(ws_user)
        ws_user.is_active = False
        await db_session.commit()

        assert await authenticate_websocket(_StubWebSocket(cookies={"access_token": token}), db_session) is None

    async def test_locked_account_is_rejected(self, db_session, ws_user):
        from app.api.dependencies import authenticate_websocket

        token = _token_for(ws_user)
        ws_user.is_locked = True
        await db_session.commit()

        assert await authenticate_websocket(_StubWebSocket(cookies={"access_token": token}), db_session) is None

    async def test_query_string_token_is_not_accepted(self, db_session, ws_user):
        """Tokens must not travel in the query string, which lands in access logs."""
        from app.api.dependencies import authenticate_websocket

        socket = _StubWebSocket(headers={"query_string": f"access_token={_token_for(ws_user)}"})

        assert await authenticate_websocket(socket, db_session) is None


class _StubSocket:
    def __init__(self, fail_send=False):
        self.accepted = False
        self.sent: list[str] = []
        self.fail_send = fail_send

    async def accept(self):
        self.accepted = True

    async def send_text(self, payload):
        if self.fail_send:
            raise RuntimeError("socket is gone")
        self.sent.append(payload)


class TestWebsocketConnectionLimits:
    async def test_per_user_cap_blocks_the_next_socket(self, reset_ws_manager):
        from app.api.v1.endpoints.websockets import ConnectionManager

        manager = ConnectionManager(max_total=10, max_per_user=2)
        assert manager.can_accept(1) is True

        await manager.connect(_StubSocket(), 1)
        await manager.connect(_StubSocket(), 1)

        assert manager.can_accept(1) is False
        assert manager.can_accept(2) is True, "another user must be unaffected"

    async def test_total_cap_blocks_everyone_once_reached(self):
        from app.api.v1.endpoints.websockets import ConnectionManager

        manager = ConnectionManager(max_total=2, max_per_user=10)
        await manager.connect(_StubSocket(), 1)
        await manager.connect(_StubSocket(), 2)

        assert manager.can_accept(3) is False

    async def test_disconnect_frees_both_the_slot_and_the_count(self):
        from app.api.v1.endpoints.websockets import ConnectionManager

        manager = ConnectionManager(max_total=10, max_per_user=1)
        socket = _StubSocket()
        await manager.connect(socket, 1)
        assert manager.can_accept(1) is False

        manager.disconnect(socket)

        assert manager.can_accept(1) is True
        assert manager.active_connections == []

    async def test_disconnect_is_idempotent(self):
        from app.api.v1.endpoints.websockets import ConnectionManager

        manager = ConnectionManager(max_total=10, max_per_user=2)
        socket = _StubSocket()
        await manager.connect(socket, 1)

        manager.disconnect(socket)
        manager.disconnect(socket)  # must not double-decrement

        # A leaked negative count would wrongly deny the user a new connection.
        assert manager._per_user.get(1) is None
        await manager.connect(_StubSocket(), 1)
        assert manager.can_accept(1) is True

    async def test_connect_accepts_the_socket(self):
        from app.api.v1.endpoints.websockets import ConnectionManager

        socket = _StubSocket()
        await ConnectionManager(max_total=1, max_per_user=1).connect(socket, 1)

        assert socket.accepted is True

    async def test_broadcast_drops_a_dead_connection_and_frees_its_slot(self):
        from app.api.v1.endpoints.websockets import ConnectionManager

        manager = ConnectionManager(max_total=10, max_per_user=1)
        dead = _StubSocket(fail_send=True)
        alive = _StubSocket()
        await manager.connect(dead, 1)
        await manager.connect(alive, 2)

        await manager.broadcast({"id": "n-1"})

        assert manager.active_connections == [alive]
        assert manager.can_accept(1) is True, "the dead user's slot must be released"
        assert alive.sent and "n-1" in alive.sent[0]


# ── Real ASGI WebSocket handshake ─────────────────────────
# The unit tests above stub the handshake attributes; these drive the actual
# ASGI app so a future refactor of the endpoint cannot quietly reopen the socket
# to anonymous clients.

class TestWebsocketHandshake:
    """End-to-end handshake through the app (sync, like Starlette's TestClient)."""

    @staticmethod
    def _seed(db_path) -> tuple:
        """Create the schema plus one active user; return (user_id, token)."""
        import asyncio

        from app.core.security import create_access_token
        from app.models.user import User

        async def seed():
            engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
            try:
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                Session = async_sessionmaker(
                    bind=engine, class_=AsyncSession, expire_on_commit=False
                )
                async with Session() as session:
                    user = User(
                        email="handshake@example.com",
                        name="Handshake User",
                        hashed_password="x",
                        role="user",
                        is_active=True,
                    )
                    session.add(user)
                    await session.commit()
                    return user.id
            finally:
                await engine.dispose()

        user_id = asyncio.run(seed())
        return user_id, create_access_token(
            data={"sub": "handshake@example.com", "user_id": user_id}
        )

    @staticmethod
    @contextmanager
    def _client(db_path):
        """Yield a TestClient whose get_db points at the temp database.

        The engine is built inside the dependency so it belongs to the event loop
        the app actually runs in (a TestClient drives its own loop).
        """
        async def override_get_db():
            engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
            Session = async_sessionmaker(
                bind=engine, class_=AsyncSession, expire_on_commit=False
            )
            try:
                async with Session() as session:
                    yield session
            finally:
                await engine.dispose()

        app.dependency_overrides[get_db] = override_get_db
        try:
            yield TestClient(app, base_url="https://testserver.local")
        finally:
            app.dependency_overrides.clear()

    def test_anonymous_handshake_is_closed_with_1008_and_never_registered(
        self, tmp_path, reset_ws_manager
    ):
        """Regression: the subscribe path was open to anyone who knew the URL.

        The rejection has to arrive as a WebSocket close frame with `1008`: closing
        before ``accept()`` makes the server answer the HTTP upgrade with `403`,
        which browsers report as the generic abnormal closure `1006` — a code
        `NotificationBell` cannot tell apart from a dropped connection, so it would
        keep retrying instead of stopping.
        """
        db_path = tmp_path / "ws.db"
        self._seed(db_path)

        with self._client(db_path) as client:
            with client.websocket_connect("/api/v1/ws/notifications") as ws:
                with pytest.raises(WebSocketDisconnect) as excinfo:
                    ws.receive_text()

        assert excinfo.value.code == 1008
        assert reset_ws_manager.active_connections == []

    def test_authenticated_handshake_connects_and_answers_ping(
        self, tmp_path, reset_ws_manager
    ):
        db_path = tmp_path / "ws.db"
        _, token = self._seed(db_path)

        with self._client(db_path) as client:
            client.cookies.set("access_token", token)
            with client.websocket_connect(
                "/api/v1/ws/notifications",
                headers={"cookie": f"access_token={token}"},
            ) as ws:
                ws.send_text("ping")
                assert ws.receive_text() == "pong"
                assert len(reset_ws_manager.active_connections) == 1

        # The handler must release the socket when the client goes away.
        assert reset_ws_manager.active_connections == []

    def test_handshake_rejects_a_token_for_an_inactive_account(self, tmp_path, reset_ws_manager):
        db_path = tmp_path / "ws.db"

        import asyncio

        _, token = self._seed(db_path)

        async def deactivate():
            from sqlalchemy import select
            from app.models.user import User

            engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
            try:
                Session = async_sessionmaker(
                    bind=engine, class_=AsyncSession, expire_on_commit=False
                )
                async with Session() as session:
                    user = (await session.execute(
                        select(User).where(User.email == "handshake@example.com")
                    )).scalar_one()
                    user.is_active = False
                    await session.commit()
            finally:
                await engine.dispose()

        asyncio.run(deactivate())

        with self._client(db_path) as client:
            with client.websocket_connect(
                "/api/v1/ws/notifications",
                headers={"cookie": f"access_token={token}"},
            ) as ws:
                with pytest.raises(WebSocketDisconnect) as excinfo:
                    ws.receive_text()

        assert excinfo.value.code == 1008
        assert reset_ws_manager.active_connections == []

    def test_handshake_rejects_when_the_instance_is_at_capacity(
        self, tmp_path, reset_ws_manager
    ):
        db_path = tmp_path / "ws.db"
        _, token = self._seed(db_path)
        reset_ws_manager.max_total = 0  # already full

        with self._client(db_path) as client:
            with client.websocket_connect(
                "/api/v1/ws/notifications",
                headers={"cookie": f"access_token={token}"},
            ) as ws:
                with pytest.raises(WebSocketDisconnect) as excinfo:
                    ws.receive_text()

        assert excinfo.value.code == 1013, "the client backs off on 1013"
        assert reset_ws_manager.active_connections == []


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


# ── Weather upstream resilience ───────────────────────────
# Open-Meteo throttles per-IP and Render instances share egress IPs, so a 429
# is routine. The proxy must retry, then fall back to stale cache rather than
# returning a hard 502 and leaving an empty card in the dashboard.

class _FakeResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class _FakeClient:
    """httpx.AsyncClient stand-in returning a scripted sequence of responses.

    `_upstream_get` builds a fresh client per attempt, so the call counter lives
    on the shared `counter` dict rather than on the instance.
    """

    def __init__(self, responses, counter):
        self._responses = list(responses)
        self._counter = counter

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        self._counter["calls"] += 1
        idx = self._counter["calls"] - 1
        return self._responses[min(idx, len(self._responses) - 1)]


def _install_fake_http(monkeypatch, responses):
    import app.api.v1.endpoints.weather as weather

    counter = {"calls": 0}

    def fake_async_client(**kwargs):
        return _FakeClient(responses, counter)

    monkeypatch.setattr(weather.httpx, "AsyncClient", fake_async_client)
    monkeypatch.setattr(weather.asyncio, "sleep", _no_sleep)
    return counter


async def _no_sleep(_seconds):
    return None


class TestWeatherUpstreamResilience:
    async def test_retries_then_succeeds_on_429(self, monkeypatch):
        """A throttled 429 must be retried, not surfaced to the user."""
        from app.api.v1.endpoints.weather import _upstream_get

        holder = _install_fake_http(monkeypatch, [
            _FakeResponse(429, text="rate limited"),
            _FakeResponse(200, {"ok": True}),
        ])

        result = await _upstream_get("https://example.test", {"a": 1})

        assert result == {"ok": True}
        assert holder["calls"] == 2, "should have retried once"

    async def test_gives_up_after_retries_exhausted(self, monkeypatch):
        from fastapi import HTTPException
        from app.api.v1.endpoints.weather import _upstream_get

        holder = _install_fake_http(monkeypatch, [_FakeResponse(429, text="nope")])

        with pytest.raises(HTTPException) as exc:
            await _upstream_get("https://example.test", {}, retries=2)

        assert exc.value.status_code == 502
        assert holder["calls"] == 3  # initial + 2 retries

    async def test_does_not_retry_client_errors(self, monkeypatch):
        """404 means our request was wrong; retrying it is pure waste."""
        from fastapi import HTTPException
        from app.api.v1.endpoints.weather import _upstream_get

        holder = _install_fake_http(monkeypatch, [_FakeResponse(404, text="nope")])

        with pytest.raises(HTTPException):
            await _upstream_get("https://example.test", {})

        assert holder["calls"] == 1

    async def test_forecast_serves_stale_cache_when_upstream_fails(self, monkeypatch, client):
        """When the provider throttles, expired-but-present data beats none."""
        from app.api.v1.endpoints import weather as w

        w._WEATHER_CACHE.clear()
        key = w._cache_key_forecast(13.7563, 100.5018, 2)
        w._cache_set(w._WEATHER_CACHE, key, {"current": {"temperature_2m": 31}})
        # Force the entry to look expired.
        w._WEATHER_CACHE[key]["ts"] -= __import__("datetime").timedelta(seconds=10_000)

        _install_fake_http(monkeypatch, [_FakeResponse(429, text="rate limited")])

        resp = await client.get(
            "/api/v1/weather/forecast",
            params={"latitude": 13.7563, "longitude": 100.5018, "forecast_days": 2},
        )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["current"]["temperature_2m"] == 31
        assert body["_stale"] is True
        assert body["_from_cache"] is True

    async def test_forecast_still_502s_with_no_cached_data(self, monkeypatch, client):
        from app.api.v1.endpoints import weather as w

        w._WEATHER_CACHE.clear()
        _install_fake_http(monkeypatch, [_FakeResponse(429, text="rate limited")])

        resp = await client.get(
            "/api/v1/weather/forecast",
            params={"latitude": 1.2345, "longitude": 6.7890, "forecast_days": 2},
        )

        assert resp.status_code == 502


# ── Persistent (database) weather cache ───────────────────
# The in-process cache dies with the process, which is exactly when a cold
# instance has nothing to fall back on. These tests cover the L2 layer that
# keeps the stale fallback alive across restarts and redeploys.

class TestWeatherPersistentCache:
    async def _forecast(self, client, **overrides):
        params = {"latitude": 13.7563, "longitude": 100.5018, "forecast_days": 2}
        params.update(overrides)
        return await client.get("/api/v1/weather/forecast", params=params)

    async def test_successful_fetch_is_persisted(self, monkeypatch, client, db_session):
        from sqlalchemy import select
        from app.api.v1.endpoints import weather as w
        from app.models.weather_cache import WeatherCacheEntry

        w._WEATHER_CACHE.clear()
        _install_fake_http(monkeypatch, [_FakeResponse(200, {"current": {"temperature_2m": 30}})])

        assert (await self._forecast(client)).status_code == 200

        rows = (await db_session.execute(select(WeatherCacheEntry))).scalars().all()
        assert [r.key for r in rows] == ["forecast:13.7563:100.5018:2"]

    async def test_restart_serves_the_persisted_entry(self, monkeypatch, client):
        """After a restart the persisted payload answers, without touching the provider."""
        from app.api.v1.endpoints import weather as w

        w._WEATHER_CACHE.clear()
        _install_fake_http(monkeypatch, [_FakeResponse(200, {"current": {"temperature_2m": 30}})])
        assert (await self._forecast(client)).status_code == 200

        # Process restarts here — L1 is empty — and the provider now refuses.
        w._WEATHER_CACHE.clear()
        holder = _install_fake_http(monkeypatch, [_FakeResponse(429, text="rate limited")])

        resp = await self._forecast(client)

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["current"]["temperature_2m"] == 30
        assert body["_from_cache"] is True
        assert holder["calls"] == 0, "the provider must not be consulted while L2 is fresh"

    async def test_restart_with_expired_entry_serves_stale_instead_of_502(
        self, monkeypatch, client, db_session
    ):
        """The exact production symptom: cold process + throttled provider."""
        from datetime import timedelta

        from sqlalchemy import select
        from app.api.v1.endpoints import weather as w
        from app.core.utils import utcnow
        from app.models.weather_cache import WeatherCacheEntry
        from app.services import weather_cache

        key = w._cache_key_forecast(13.7563, 100.5018, 2)
        w._WEATHER_CACHE.clear()
        await weather_cache.store(
            db_session, w.NS_FORECAST, key, {"current": {"temperature_2m": 30}}
        )
        row = (await db_session.execute(select(WeatherCacheEntry).where(
            WeatherCacheEntry.key == weather_cache.build_key(w.NS_FORECAST, key)
        ))).scalar_one()
        row.updated_at = utcnow() - timedelta(seconds=w.FORECAST_CACHE_TTL + 60)
        await db_session.commit()

        _install_fake_http(monkeypatch, [_FakeResponse(429, text="rate limited")])

        resp = await self._forecast(client)

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["current"]["temperature_2m"] == 30
        assert body["_stale"] is True
        assert body["_from_cache"] is True

    async def test_fresh_database_entry_avoids_the_upstream_call(
        self, monkeypatch, client, db_session
    ):
        from app.api.v1.endpoints import weather as w
        from app.services import weather_cache

        w._WEATHER_CACHE.clear()
        await weather_cache.store(
            db_session, w.NS_FORECAST, w._cache_key_forecast(13.7563, 100.5018, 2),
            {"current": {"temperature_2m": 28}},
        )
        holder = _install_fake_http(monkeypatch, [_FakeResponse(200, {"current": {}})])

        resp = await self._forecast(client)

        assert resp.status_code == 200
        assert resp.json()["current"]["temperature_2m"] == 28
        assert holder["calls"] == 0, "a warm database entry must not hit the provider"

    async def test_expired_database_entry_is_refetched(
        self, monkeypatch, client, db_session
    ):
        """A row past its TTL must be refreshed, not served as if it were current."""
        from datetime import timedelta

        from sqlalchemy import select
        from app.api.v1.endpoints import weather as w
        from app.core.utils import utcnow
        from app.models.weather_cache import WeatherCacheEntry
        from app.services import weather_cache

        w._WEATHER_CACHE.clear()
        key = w._cache_key_forecast(13.7563, 100.5018, 2)
        await weather_cache.store(
            db_session, w.NS_FORECAST, key, {"current": {"temperature_2m": 21}}
        )

        row = (await db_session.execute(select(WeatherCacheEntry).where(
            WeatherCacheEntry.key == weather_cache.build_key(w.NS_FORECAST, key)
        ))).scalar_one()
        row.updated_at = utcnow() - timedelta(seconds=w.FORECAST_CACHE_TTL + 60)
        await db_session.commit()

        holder = _install_fake_http(
            monkeypatch, [_FakeResponse(200, {"current": {"temperature_2m": 33}})]
        )

        resp = await self._forecast(client)

        assert resp.status_code == 200
        assert resp.json()["current"]["temperature_2m"] == 33
        assert holder["calls"] == 1, "an expired entry must be re-fetched, not served"

    async def test_store_prunes_rows_past_the_retention_window(self, db_session):
        """Rows beyond MAX_AGE go — except the one row each namespace keeps."""
        from datetime import timedelta

        from sqlalchemy import select
        from app.core.utils import utcnow
        from app.models.weather_cache import WeatherCacheEntry
        from app.services import weather_cache

        newest_stale = utcnow() - weather_cache.MAX_AGE - timedelta(days=1)
        older_stale = utcnow() - weather_cache.MAX_AGE - timedelta(days=9)
        db_session.add_all([
            WeatherCacheEntry(key="forecast:1.0:2.0:1", payload="{}", updated_at=older_stale),
            WeatherCacheEntry(key="forecast:5.0:6.0:1", payload="{}", updated_at=newest_stale),
        ])
        await db_session.commit()

        await weather_cache.store(db_session, "geocode", (3.0, 4.0, "th"), {"ok": True})

        keys = [r.key for r in (await db_session.execute(select(WeatherCacheEntry))).scalars().all()]
        assert "forecast:1.0:2.0:1" not in keys, "not the namespace's newest row -> prunable"
        assert "forecast:5.0:6.0:1" in keys, "the last fallback of a namespace must survive"
        assert "geocode:3.0:4.0:th" in keys

    async def test_pruning_keeps_one_row_per_namespace(self, db_session):
        """A cold instance with one ancient row can still answer; without it, 502."""
        from datetime import timedelta

        from sqlalchemy import select
        from app.core.utils import utcnow
        from app.models.weather_cache import WeatherCacheEntry
        from app.services import weather_cache

        ancient = utcnow() - timedelta(days=400)
        db_session.add_all([
            WeatherCacheEntry(key="forecast:1.0:2.0:1", payload="{}", updated_at=ancient),
            WeatherCacheEntry(key="air-quality:1.0:2.0", payload="{}", updated_at=ancient),
            WeatherCacheEntry(key="oil-prices:latest", payload="{}", updated_at=ancient),
        ])
        await db_session.commit()

        await weather_cache.store(db_session, "geocode", (9.0, 9.0, "th"), {"ok": True})

        keys = {r.key for r in (await db_session.execute(select(WeatherCacheEntry))).scalars().all()}
        assert keys == {
            "forecast:1.0:2.0:1",
            "air-quality:1.0:2.0",
            "oil-prices:latest",
            "geocode:9.0:9.0:th",
        }

    async def test_cache_errors_do_not_break_the_proxy(self):
        """The cache is best-effort: database failures must be swallowed, not raised.

        The weather proxies are reachable without authentication so the login page
        can render them, which means a database outage must not be able to take the
        widget down as well.
        """
        from app.services import weather_cache

        class BrokenSession:
            """Stands in for a session whose database just went away."""

            async def execute(self, *args, **kwargs):
                raise RuntimeError("database unavailable")

            async def get(self, *args, **kwargs):
                raise RuntimeError("database unavailable")

            async def rollback(self):
                raise RuntimeError("database unavailable")

        broken = BrokenSession()
        key = (13.7563, 100.5018, 2)

        assert await weather_cache.get_fresh(broken, "forecast", key, 600) is None
        assert await weather_cache.get_stale(broken, "forecast", key) is None
        await weather_cache.store(broken, "forecast", key, {"ok": True})  # must not raise


# ── Health probes ─────────────────────────────────────────
# /health was a hardcoded "healthy" string, so a deployment whose database was
# unreachable looked perfect to every monitor that watched it.

class _BrokenEngine:
    """Stands in for an engine whose database just went away."""

    def connect(self):
        raise RuntimeError("database unavailable")


class TestHealthProbes:
    async def test_health_reports_a_reachable_database(self, client):
        resp = await client.get("/health")

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert body["database"]["status"] == "ok"
        assert isinstance(body["database"]["latency_ms"], float)

    async def test_health_stays_200_but_reports_degraded_without_a_database(
        self, client, monkeypatch
    ):
        """Liveness keeps answering 200 so existing uptime monitors keep working."""
        from app import main

        monkeypatch.setattr(main, "engine", _BrokenEngine())

        resp = await client.get("/health")

        assert resp.status_code == 200
        assert resp.json()["status"] == "degraded"
        assert resp.json()["database"] == {"status": "down", "latency_ms": None}

    async def test_readiness_reports_ready_with_a_database(self, client):
        resp = await client.get("/health/ready")

        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"

    async def test_readiness_fails_without_a_database(self, client, monkeypatch):
        from app import main

        monkeypatch.setattr(main, "engine", _BrokenEngine())

        resp = await client.get("/health/ready")

        assert resp.status_code == 503
        assert resp.json()["status"] == "not_ready"
        assert resp.json()["database"]["status"] == "down"


# ── Request correlation ───────────────────────────────────
# Every response used to be untraceable: no id in the logs, no id in the
# headers, so a report of "the request failed" could not be followed up.

class TestRequestIdMiddleware:
    async def test_every_response_carries_a_request_id(self, client):
        resp = await client.get("/")

        assert resp.headers.get("X-Request-ID")

    async def test_a_safe_caller_supplied_id_is_echoed(self, client):
        """An inbound trace id must survive, or nothing lines up across services."""
        resp = await client.get("/", headers={"X-Request-ID": "trace-4f2a"})

        assert resp.headers["X-Request-ID"] == "trace-4f2a"

    async def test_an_id_with_unsafe_characters_is_replaced(self, client):
        """The id is echoed into a header and into the logs, so it is validated."""
        resp = await client.get("/", headers={"X-Request-ID": "not a valid id!"})

        assert resp.headers["X-Request-ID"]
        assert resp.headers["X-Request-ID"] != "not a valid id!"

    def test_the_log_filter_stamps_the_current_id(self):
        import logging

        from app.core.observability import _RequestIdFilter, _request_id

        record = logging.LogRecord("test", logging.INFO, __file__, 1, "hello", None, None)
        token = _request_id.set("abc123")
        try:
            assert _RequestIdFilter().filter(record) is True
        finally:
            _request_id.reset(token)

        assert record.request_id == "abc123"


# ── Client address resolution ─────────────────────────────
# The rate limiter keyed on the leftmost X-Forwarded-For entry, which any client
# could invent; a rotating header meant a fresh bucket per request.

def _request_from(peer, headers):
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "query_string": b"",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }
    if peer is not None:
        scope["client"] = (peer, 51234)
    return Request(scope)


class TestClientIpResolution:
    @pytest.fixture(autouse=True)
    def _no_explicit_proxies(self, monkeypatch):
        from app.core import rate_limit

        monkeypatch.setattr(rate_limit.settings, "TRUSTED_PROXY_IPS", "")
        yield

    def test_a_public_peer_cannot_choose_its_own_address(self):
        from app.core.rate_limit import get_real_client_ip

        request = _request_from("203.0.113.7", {"X-Forwarded-For": "1.2.3.4"})

        assert get_real_client_ip(request) == "203.0.113.7"

    def test_the_spoofed_leftmost_entry_is_skipped_behind_a_proxy(self):
        from app.core.rate_limit import get_real_client_ip

        request = _request_from("10.0.0.5", {"X-Forwarded-For": "1.2.3.4, 203.0.113.7"})

        assert get_real_client_ip(request) == "203.0.113.7"

    def test_an_all_proxy_chain_falls_back_to_its_first_entry(self):
        from app.core.rate_limit import get_real_client_ip

        request = _request_from("10.0.0.5", {"X-Forwarded-For": "10.0.0.9, 10.0.0.8"})

        assert get_real_client_ip(request) == "10.0.0.9"

    def test_x_real_ip_is_honoured_when_xff_is_absent(self):
        from app.core.rate_limit import get_real_client_ip

        request = _request_from("10.0.0.5", {"X-Real-IP": "8.8.8.8"})

        assert get_real_client_ip(request) == "8.8.8.8"

    def test_the_peer_is_used_when_no_header_is_present(self):
        from app.core.rate_limit import get_real_client_ip

        assert get_real_client_ip(_request_from("203.0.113.7", {})) == "203.0.113.7"

    def test_an_unparseable_peer_is_never_trusted(self):
        """Starlette's TestClient reports the peer as "testclient"."""
        from app.core.rate_limit import get_real_client_ip

        request = _request_from("testclient", {"X-Forwarded-For": "9.9.9.9"})

        assert get_real_client_ip(request) == "testclient"

    def test_ipv4_mapped_ipv6_peers_are_unwrapped(self):
        from app.core.rate_limit import get_real_client_ip

        request = _request_from("::ffff:10.0.0.5", {"X-Forwarded-For": "8.8.8.8"})

        assert get_real_client_ip(request) == "8.8.8.8"

    def test_explicit_proxies_replace_the_private_range_default(self, monkeypatch):
        from app.core import rate_limit

        monkeypatch.setattr(rate_limit.settings, "TRUSTED_PROXY_IPS", "198.51.100.0/24")

        assert rate_limit.get_real_client_ip(
            _request_from("198.51.100.10", {"X-Forwarded-For": "8.8.8.8"})
        ) == "8.8.8.8"
        # A private peer is no longer trusted merely for being private.
        assert rate_limit.get_real_client_ip(
            _request_from("10.0.0.5", {"X-Forwarded-For": "8.8.8.8"})
        ) == "10.0.0.5"

    def test_malformed_entries_are_ignored(self, monkeypatch):
        from app.core import rate_limit

        monkeypatch.setattr(
            rate_limit.settings, "TRUSTED_PROXY_IPS", "10.0.0.0/8, not-an-ip"
        )

        assert len(rate_limit.trusted_networks()) == 1


# ── Oil price caching ─────────────────────────────────────
# The widget is unauthenticated and Bangchak is the only provider, so a restart
# used to come up with nothing to serve while the upstream was unreachable.

class _FakeOilClient(_FakeClient):
    """httpx stand-in for the oil endpoint, which passes `headers=`."""

    async def get(self, url, headers=None):
        return await super().get(url)


def _bangchak_payload(price_95=40.69):
    return [
        {
            "OilList": [
                {"OilName": "Gasohol 95", "PriceToday": price_95},
                {"OilName": "Gasohol 91", "PriceToday": 40.32},
                {"OilName": "Hi Diesel S", "PriceToday": 42.19},
            ]
        }
    ]


def _install_oil_http(monkeypatch, responses):
    from app.api.v1.endpoints import oil_prices as oil

    counter = {"calls": 0}
    monkeypatch.setattr(
        oil.httpx, "AsyncClient", lambda **kwargs: _FakeOilClient(responses, counter)
    )
    return counter


class TestOilPriceCacheLayers:
    OIL_URL = "/api/v1/oil-prices/oil-prices"

    @pytest.fixture(autouse=True)
    def _clean_process_cache(self):
        from app.api.v1.endpoints import oil_prices as oil

        def reset():
            oil._cache["data"] = None
            oil._cache["timestamp"] = None

        reset()
        yield
        reset()

    async def test_a_successful_fetch_is_persisted(self, client, db_session, monkeypatch):
        from app.api.v1.endpoints import oil_prices as oil
        from app.services import weather_cache

        _install_oil_http(monkeypatch, [_FakeResponse(200, _bangchak_payload())])

        resp = await client.get(self.OIL_URL)

        assert resp.status_code == 200
        assert resp.json()["is_stale"] is False
        persisted = await weather_cache.get_stale(db_session, oil.NS_OIL_PRICES, oil._L2_KEY)
        assert persisted is not None
        assert persisted["prices"], "the parsed price list is what a restart needs"

    async def test_a_restart_serves_the_persisted_row_without_calling_out(
        self, client, db_session, monkeypatch
    ):
        from app.api.v1.endpoints import oil_prices as oil
        from app.services import weather_cache

        await weather_cache.store(
            db_session,
            oil.NS_OIL_PRICES,
            oil._L2_KEY,
            {
                "success": True,
                "prices": [{"key": "diesel", "name": "ดีเซล", "price": 42.19, "unit": "บาท/ลิตร"}],
                "update_date": "06/10/2026",
                "fetched_at": "2026-10-06T06:00:00Z",
                "is_stale": False,
                "source": "Bangchak / Retail Station",
            },
        )
        counter = _install_oil_http(monkeypatch, [_FakeResponse(500, text="boom")])

        resp = await client.get(self.OIL_URL)

        assert resp.status_code == 200
        assert resp.json()["prices"][0]["price"] == 42.19
        assert resp.json()["is_stale"] is False
        assert counter["calls"] == 0, "a warm persistent row must not hit the provider"

    async def test_an_expired_row_is_served_stale_when_the_provider_fails(
        self, client, db_session, monkeypatch
    ):
        from datetime import timedelta

        from sqlalchemy import select

        from app.api.v1.endpoints import oil_prices as oil
        from app.core.utils import utcnow
        from app.models.weather_cache import WeatherCacheEntry
        from app.services import weather_cache

        await weather_cache.store(
            db_session, oil.NS_OIL_PRICES, oil._L2_KEY, {"prices": [], "source": "Bangchak"}
        )
        row = (
            await db_session.execute(
                select(WeatherCacheEntry).where(
                    WeatherCacheEntry.key
                    == weather_cache.build_key(oil.NS_OIL_PRICES, oil._L2_KEY)
                )
            )
        ).scalar_one()
        row.updated_at = utcnow() - timedelta(seconds=oil.CACHE_TTL + 60)
        await db_session.commit()

        _install_oil_http(monkeypatch, [_FakeResponse(503, text="maintenance")])

        resp = await client.get(self.OIL_URL)

        assert resp.status_code == 200
        body = resp.json()
        assert body["is_stale"] is True
        assert "(cache)" in body["source"]

    async def test_without_any_cache_the_maintained_constants_are_served(
        self, client, monkeypatch
    ):
        _install_oil_http(monkeypatch, [_FakeResponse(500, text="boom")])

        resp = await client.get(self.OIL_URL)

        assert resp.status_code == 200
        body = resp.json()
        assert body["is_stale"] is True
        assert body["source"] == "Market Base Rate"
        assert body["fetched_at"] is None
        assert len(body["prices"]) == 6

    def test_the_dead_eppo_provider_constant_is_gone(self):
        """It was declared but never read; the docs pointed at it as if it worked."""
        from app.api.v1.endpoints import oil_prices as oil

        assert not hasattr(oil, "EPPO_OIL_URL")


# ── WebSocket broadcast fan-out ───────────────────────────
# Broadcasts are process-local by default; WS_BROADCAST_REDIS_URL is what makes
# them reach the clients of other instances instead of only this one's.

class TestBroadcastBus:
    async def test_a_local_publish_reaches_the_handler(self):
        from app.services.ws_bus import BroadcastBus

        received = []

        async def handler(message):
            received.append(message)

        bus = BroadcastBus(url="")
        await bus.start(handler)
        try:
            assert bus.shared is False
            await bus.publish({"id": "n-1"})
        finally:
            await bus.stop()

        assert received == [{"id": "n-1"}]

    async def test_a_shared_publish_goes_to_redis_only(self):
        import json

        from app.services.ws_bus import BroadcastBus

        published = []
        received = []

        class _Client:
            async def publish(self, channel, payload):
                published.append((channel, payload))

        async def handler(message):
            received.append(message)

        bus = BroadcastBus(url="redis://example.invalid:6379/0", channel="art:test")
        bus._handler = handler
        bus._client = _Client()  # as if start() had connected

        await bus.publish({"id": "n-2"})

        assert published and published[0][0] == "art:test"
        assert json.loads(published[0][1]) == {"id": "n-2"}
        assert received == [], "the subscriber delivers, not the publisher"

    async def test_a_broken_broker_still_delivers_locally(self):
        from app.services.ws_bus import BroadcastBus

        received = []

        class _Client:
            async def publish(self, channel, payload):
                raise RuntimeError("redis is down")

        async def handler(message):
            received.append(message)

        bus = BroadcastBus(url="redis://example.invalid:6379/0")
        bus._handler = handler
        bus._client = _Client()

        await bus.publish({"id": "n-3"})

        assert received == [{"id": "n-3"}]

    async def test_subscription_messages_are_delivered_and_junk_is_ignored(self):
        import asyncio

        from app.services.ws_bus import BroadcastBus

        received = []

        async def handler(message):
            received.append(message)

        bus = BroadcastBus(url="redis://example.invalid:6379/0")
        bus._handler = handler

        bus._handle_message({"type": "message", "data": '{"id": "n-4"}'})
        bus._handle_message({"type": "subscribe", "data": 1})
        bus._handle_message({"type": "message", "data": "not json"})
        bus._handle_message({"type": "message", "data": "[1, 2]"})
        await asyncio.sleep(0)

        assert received == [{"id": "n-4"}]

    async def test_a_missing_redis_package_degrades_to_local_delivery(self, monkeypatch):
        """A configured broker that cannot be imported must not drop messages."""
        import builtins

        from app.services.ws_bus import BroadcastBus

        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "redis.asyncio" or name.startswith("redis"):
                raise ImportError("no module named redis")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)

        received = []

        async def handler(message):
            received.append(message)

        bus = BroadcastBus(url="redis://example.invalid:6379/0")
        await bus.start(handler)
        try:
            await bus.publish({"id": "n-5"})
        finally:
            await bus.stop()

        assert received == [{"id": "n-5"}]


class TestLifespanWiring:
    def test_startup_registers_the_handler_and_shutdown_releases_it(self, monkeypatch):
        """Without this wiring a broadcast would be published into nothing."""
        from app.core.config import settings
        from app.main import app
        from app.services.ws_bus import broadcast_bus

        # No schema work at startup: the subject here is the bus wiring, and
        # touching the app engine would leave a pooled connection bound to this
        # test's event loop for the next test to trip over.
        monkeypatch.setattr(settings, "AUTO_CREATE_TABLES", False)

        with TestClient(app) as test_client:
            assert broadcast_bus._handler is not None
            assert test_client.get("/").status_code == 200

        assert broadcast_bus._handler is None, "shutdown must release the registry"


# ── High-severity regressions: audit persistence + user cookie encoding ──


class TestAuditTrailPersistence:
    """Successful actions must leave their audit row behind.

    AuditService.log_action() only adds to the session — the endpoint owns the
    commit. These endpoints used to return success while the audit INSERT was
    rolled back with the request session, so a password change or an
    admin-created account left no trace.
    """

    async def test_profile_update_persists_audit_row(
        self, client, logged_in_user, db_session
    ):
        resp = await client.put("/api/v1/profile/me", json={"name": "Renamed"})
        assert resp.status_code == 200, resp.text
        # Discard whatever the request left uncommitted — exactly what the real
        # request-scoped session teardown does. Only committed rows survive.
        await db_session.rollback()
        rows = (
            await db_session.execute(
                select(AuditLog).where(AuditLog.action == "PROFILE_UPDATE")
            )
        ).scalars().all()
        assert rows, "PROFILE_UPDATE succeeded but its audit row was rolled back"

    async def test_password_change_persists_audit_row(
        self, client, logged_in_user, db_session
    ):
        resp = await client.post(
            "/api/v1/profile/change-password",
            json={"old_password": "SecretPass123", "new_password": "NewSecret456"},
        )
        assert resp.status_code == 200, resp.text
        await db_session.rollback()
        rows = (
            await db_session.execute(
                select(AuditLog).where(AuditLog.action == "PASSWORD_CHANGE")
            )
        ).scalars().all()
        assert rows, "PASSWORD_CHANGE succeeded but its audit row was rolled back"

    async def test_avatar_update_persists_audit_row(
        self, client, logged_in_user, db_session
    ):
        resp = await client.post(
            "/api/v1/profile/avatar",
            json={"avatar_base64": "data:image/png;base64,AAAA"},
        )
        assert resp.status_code == 200, resp.text
        await db_session.rollback()
        rows = (
            await db_session.execute(
                select(AuditLog).where(AuditLog.action == "AVATAR_UPDATE")
            )
        ).scalars().all()
        assert rows, "AVATAR_UPDATE succeeded but its audit row was rolled back"

    async def test_admin_create_persists_audit_row(self, admin_client, db_session):
        resp = await admin_client.post(
            "/api/v1/users/admin-create",
            json={
                "username": "audituser",
                "display_name": "Audit User",
                "password": "SecretPass123",
            },
        )
        assert resp.status_code == 201, resp.text
        await db_session.rollback()
        rows = (
            await db_session.execute(
                select(AuditLog).where(AuditLog.action == "ADMIN_USER_CREATE_HYBRID")
            )
        ).scalars().all()
        assert rows, "admin-create succeeded but its audit row was rolled back"


class TestUserCookieFormat:
    """The readable `user` cookie must survive a document.cookie-style read.

    Starlette quotes and octal-escapes a raw json.dumps value (commas become
    `\\054`), and the browser stores that escaped form verbatim — every
    frontend JSON.parse on it failed. The backend now percent-encodes the
    payload itself, so the stored value is exactly what the frontend decodes.
    """

    async def test_login_user_cookie_is_plain_percent_encoded_json(
        self, client, registered_user
    ):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "SecretPass123"},
        )
        assert resp.status_code == 200, resp.text

        raw_header = next(
            (
                header
                for header in resp.headers.get_list("set-cookie")
                if header.startswith("user=")
            ),
            None,
        )
        assert raw_header is not None, "login must set the readable user cookie"

        value = raw_header.split(";", 1)[0][len("user="):]
        # The old failure mode: `user="{\"id\": 1\054 ...}"` — quoted + octal escapes.
        assert not value.startswith('"'), f"cookie value is quoted: {value[:60]}"
        assert "\\" not in value, "cookie value must not contain backslash escapes"
        assert " " not in value, "cookie value must not contain raw spaces"

        decoded = json.loads(unquote(value))
        assert decoded["email"] == "test@example.com"
        assert decoded["role"] == "user"

    async def test_session_fast_path_reads_the_encoded_cookie(
        self, client, logged_in_user
    ):
        """Prove the fast-path consumes the cookie instead of the DB fallback."""
        override = {
            "id": 999,
            "email": "test@example.com",
            "name": "Cookie Override",
            "role": "user",
        }
        client.cookies.set("user", encode_user_cookie(override))

        resp = await client.get("/api/v1/auth/session")
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["user"]["name"] == "Cookie Override"

    async def test_cookie_helpers_round_trip(self):
        payload = {"id": 7, "name": "สมชาย, Jr.", "role": "admin", "avatar": None}
        encoded = encode_user_cookie(payload)

        # Only cookie-legal characters, so the serialiser has nothing to escape.
        assert '"' not in encoded and "," not in encoded and " " not in encoded
        assert decode_user_cookie(encoded) == payload
        assert decode_user_cookie("not-json") is None
        # A stale legacy value from before this fix decodes to None, not garbage.
        assert decode_user_cookie('"{\\"id\\": 1\\054 \\"role\\": \\"admin\\"}"') is None
