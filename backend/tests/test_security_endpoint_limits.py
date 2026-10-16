"""Regression tests for the per-endpoint rate limits (T18).

The suite disables the limiter globally (``tests/conftest.py``), so these tests
switch it back on locally, shrink every registered route limit, and restore both
afterwards. The avatar upload is the one endpoint with its own tighter bucket.
"""

import io

import pytest
from PIL import Image

from app.core.config import settings
from app.main import app

from app.api.v1.endpoints.profile import AVATAR_MAX_BYTES


def _png_bytes(size=(16, 16)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (20, 120, 20)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def shrunk_limits(client):
    """Enable the limiter and shrink every route limit to 5/minute.

    SlowAPI resolves ``@limiter.limit("N/minute")`` at import time and stores a
    Limit object per route, so mutating settings afterwards has no effect — the
    registered Limit objects themselves have to be patched (same approach as
    ``tests/test_api.py``).
    """
    from limits import parse_many

    from app.core.rate_limit import limiter

    limiter.enabled = True
    limiter.reset()

    shrunk = parse_many("5 per 1 minute")[0]
    touched = []
    for limits in limiter._route_limits.values():
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


@pytest.fixture
def real_limits(client):
    """Enable the limiter with the limits the application actually ships."""
    from app.core.rate_limit import limiter

    limiter.enabled = True
    limiter.reset()
    try:
        yield client
    finally:
        limiter.reset()
        limiter.enabled = False


@pytest.fixture
async def admin_client(client, db_session, registered_user):
    """Promote the shared test account to admin and log in again."""
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


# ── Coverage: nothing in the three modules is left unthrottled ──────────────


def test_every_profile_users_and_audit_endpoint_is_rate_limited():
    """A new endpoint added without a limit would silently be unlimited."""
    from app.api.v1.endpoints import audit, profile, users

    from app.core.rate_limit import limiter

    limited_functions = set(limiter._route_limits)
    modules = {audit.__name__, profile.__name__, users.__name__}

    missing = []
    for route in app.routes:
        endpoint = getattr(route, "endpoint", None)
        if endpoint is None or endpoint.__module__ not in modules:
            continue
        qualified = f"{endpoint.__module__}.{endpoint.__name__}"
        if qualified not in limited_functions:
            missing.append(f"{route.path} ({qualified})")

    assert not missing, f"endpoints without a rate limit: {missing}"


# ── The throttled responses themselves ─────────────────────────────────────


async def test_profile_sessions_returns_429_once_the_limit_is_hit(
    shrunk_limits, logged_in_user
):
    codes = []
    for _ in range(9):
        resp = await shrunk_limits.get("/api/v1/profile/sessions")
        codes.append(resp.status_code)

    assert 429 in codes, f"rate limit never engaged: {codes}"
    assert codes[-1] == 429


async def test_audit_endpoint_returns_429_once_the_limit_is_hit(
    shrunk_limits, admin_client
):
    codes = []
    for _ in range(9):
        resp = await shrunk_limits.get("/api/v1/audit/paginated")
        codes.append(resp.status_code)

    assert 429 in codes, f"rate limit never engaged: {codes}"


async def test_users_endpoint_returns_429_once_the_limit_is_hit(
    shrunk_limits, admin_client
):
    codes = []
    for _ in range(9):
        resp = await shrunk_limits.get("/api/v1/users/")
        codes.append(resp.status_code)

    assert 429 in codes, f"rate limit never engaged: {codes}"


async def test_anonymous_calls_are_rejected_before_the_limit_is_consumed(
    shrunk_limits,
):
    """Dependencies run before the endpoint, so a 401 must not burn the bucket.

    (It also means the limit alone can never be the thing that keeps an admin
    endpoint safe — the auth dependency still runs first.)
    """
    for _ in range(9):
        resp = await shrunk_limits.get("/api/v1/profile/me")
        assert resp.status_code in (401, 403), resp.text


async def test_upload_avatar_has_its_own_tighter_bucket(real_limits, logged_in_user):
    """Avatar uploads are limited by RATE_LIMIT_UPLOAD_PER_MINUTE, not general."""
    assert settings.RATE_LIMIT_UPLOAD_PER_MINUTE < settings.RATE_LIMIT_GENERAL_PER_MINUTE

    codes = []
    for _ in range(settings.RATE_LIMIT_UPLOAD_PER_MINUTE + 1):
        resp = await real_limits.post(
            "/api/v1/profile/upload-avatar",
            files={"file": ("avatar.png", _png_bytes(), "image/png")},
        )
        codes.append(resp.status_code)

    assert codes[: settings.RATE_LIMIT_UPLOAD_PER_MINUTE] == [200] * settings.RATE_LIMIT_UPLOAD_PER_MINUTE
    assert codes[-1] == 429, f"the 6th upload must be throttled, got {codes}"


# ── Bounded upload read (B3) ───────────────────────────────────────────────


async def test_oversized_upload_is_read_with_a_bounded_buffer(
    client, logged_in_user, monkeypatch
):
    """The endpoint must not read an unbounded body into memory.

    It used to call ``file.read()`` and only then compare the length, so a
    caller could push arbitrary amounts of data through the worker.
    """
    import starlette.datastructures as starlette_datastructures

    original_read = starlette_datastructures.UploadFile.read
    requested_sizes: list[int] = []

    async def spy_read(self, size=-1):
        requested_sizes.append(size)
        return await original_read(self, size)

    monkeypatch.setattr(starlette_datastructures.UploadFile, "read", spy_read)

    resp = await client.post(
        "/api/v1/profile/upload-avatar",
        files={"file": ("big.png", b"\x89PNG" + b"A" * (3 * 1024 * 1024), "image/png")},
    )

    assert resp.status_code == 400, resp.text
    assert requested_sizes == [AVATAR_MAX_BYTES + 1], (
        "the upload must be read with the cap applied, not in full"
    )
