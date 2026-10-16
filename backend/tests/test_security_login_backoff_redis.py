"""Regression tests for the shared (Redis) login brute-force backoff (T20).

The in-process counter only throttles the instance that saw the failures, so
behind a load balancer an attacker gets a fresh budget per instance. When
SLOWAPI_STORAGE_URI (or WS_BROADCAST_REDIS_URL) is a redis:// URI the counter
lives in Redis instead, and any Redis failure falls open — a cache outage must
never become a login outage.
"""

import hashlib
from typing import Optional

import pytest

from app.core.config import settings
from app.services import auth_service as auth_service_mod
from app.services.auth_service import (
    _BACKOFF_MAX_FAILURES,
    _REDIS_BACKOFF_TTL_SECONDS,
    _shared_redis_url,
)

EMAIL = "test@example.com"
PASSWORD = "SecretPass123"
CLIENT_IP = "127.0.0.1"  # what httpx's ASGITransport presents as request.client


class _FakeRedis:
    """Minimal async stand-in for redis.asyncio covering the backoff calls."""

    def __init__(self) -> None:
        self.values: dict[str, int] = {}
        self.expires: dict[str, int] = {}
        self.fail = False

    async def get(self, key):
        if self.fail:
            raise ConnectionError("redis is down")
        value = self.values.get(key)
        return None if value is None else str(value)

    async def incr(self, key):
        if self.fail:
            raise ConnectionError("redis is down")
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    async def expire(self, key, ttl):
        if self.fail:
            raise ConnectionError("redis is down")
        self.expires[key] = ttl
        return True

    async def delete(self, key):
        if self.fail:
            raise ConnectionError("redis is down")
        self.values.pop(key, None)
        self.expires.pop(key, None)
        return 1


def _expected_key(email: str = EMAIL, ip: Optional[str] = CLIENT_IP) -> str:
    digest = hashlib.sha256(email.encode("utf-8")).hexdigest()
    return f"login_fail:{ip or 'unknown'}:{digest}"


@pytest.fixture(autouse=True)
def clean_backoff():
    """No counter, cached client or throttled log may leak between tests."""
    auth_service_mod._login_backoff.clear()
    auth_service_mod._redis_error_logged_at = 0.0
    yield
    auth_service_mod._login_backoff.clear()
    auth_service_mod._redis_client_cache = None
    auth_service_mod._redis_client_url = None


@pytest.fixture
def memory_backend(monkeypatch):
    """Pin the settings so the in-process counter is the backend under test."""
    monkeypatch.setattr(settings, "SLOWAPI_STORAGE_URI", "memory://")
    monkeypatch.setattr(settings, "WS_BROADCAST_REDIS_URL", "")
    monkeypatch.setattr(auth_service_mod, "_redis_backoff_client", lambda: None)


@pytest.fixture
def redis_backend(monkeypatch):
    """Select the Redis backend and hand it a fake client."""
    fake = _FakeRedis()
    monkeypatch.setattr(settings, "SLOWAPI_STORAGE_URI", "redis://backoff.test:6379/0")
    monkeypatch.setattr(settings, "WS_BROADCAST_REDIS_URL", "")
    monkeypatch.setattr(auth_service_mod, "_redis_backoff_client", lambda: fake)
    return fake


def _login(client, password):
    return client.post("/api/v1/auth/login", json={"email": EMAIL, "password": password})


async def _fail_login(client, times):
    codes = []
    for _ in range(times):
        codes.append((await _login(client, "WrongPass1")).status_code)
    return codes


# ── Which backend is selected ───────────────────────────────────────────────


def test_shared_redis_uri_is_read_from_either_setting(monkeypatch):
    monkeypatch.setattr(settings, "SLOWAPI_STORAGE_URI", "redis://a.example:6379/0")
    monkeypatch.setattr(settings, "WS_BROADCAST_REDIS_URL", "")
    assert _shared_redis_url() == "redis://a.example:6379/0"

    # The WebSocket bus URI counts too (TLS variant included).
    monkeypatch.setattr(settings, "SLOWAPI_STORAGE_URI", "memory://")
    monkeypatch.setattr(settings, "WS_BROADCAST_REDIS_URL", "rediss://b.example:6380/1")
    assert _shared_redis_url() == "rediss://b.example:6380/1"

    monkeypatch.setattr(settings, "WS_BROADCAST_REDIS_URL", "")
    assert _shared_redis_url() == "", "no redis URI means the in-process counter"


# ── In-process backend (the fallback) ──────────────────────────────────────


async def test_in_memory_backoff_accumulates_and_throttles(
    client, registered_user, memory_backend
):
    """The fallback bucket must actually fill up (T20 fixed it: it never did)."""
    codes = await _fail_login(client, _BACKOFF_MAX_FAILURES)
    assert codes == [401] * _BACKOFF_MAX_FAILURES

    throttled = await _login(client, PASSWORD)
    assert throttled.status_code == 429, "the in-process backoff must apply"


# ── Redis backend ──────────────────────────────────────────────────────────


async def test_redis_backoff_records_failures_with_a_ttl(
    client, registered_user, redis_backend
):
    codes = await _fail_login(client, _BACKOFF_MAX_FAILURES)
    assert codes == [401] * _BACKOFF_MAX_FAILURES

    key = _expected_key()
    assert redis_backend.values[key] == _BACKOFF_MAX_FAILURES
    assert redis_backend.expires[key] == _REDIS_BACKOFF_TTL_SECONDS
    assert EMAIL not in key, "the identifier must be hashed, not stored verbatim"

    throttled = await _login(client, PASSWORD)
    assert throttled.status_code == 429


async def test_redis_counter_is_shared_across_instances(
    client, registered_user, redis_backend
):
    """A bucket filled by another instance (or another worker) must block here."""
    redis_backend.values[_expected_key()] = _BACKOFF_MAX_FAILURES

    # Even the CORRECT password is refused: the backoff is checked first.
    blocked = await _login(client, PASSWORD)
    assert blocked.status_code == 429


async def test_other_ip_and_other_identity_are_not_blocked(
    client, registered_user, redis_backend
):
    """The bucket stays keyed by (identity, IP): a shared block would be a DoS."""
    redis_backend.values[_expected_key(ip="10.0.0.9")] = _BACKOFF_MAX_FAILURES
    redis_backend.values[_expected_key(email="someone@else.example")] = _BACKOFF_MAX_FAILURES

    allowed = await _login(client, PASSWORD)
    assert allowed.status_code == 200, allowed.text


async def test_successful_login_clears_the_redis_counter(
    client, registered_user, redis_backend
):
    redis_backend.values[_expected_key()] = 2

    ok = await _login(client, PASSWORD)
    assert ok.status_code == 200, ok.text
    assert _expected_key() not in redis_backend.values, "success must clear the bucket"


# ── Fail-open ──────────────────────────────────────────────────────────────


async def test_redis_outage_fails_open(client, registered_user, redis_backend):
    """A broken Redis must not turn into a broken login."""
    redis_backend.fail = True

    wrong = await _login(client, "WrongPass1")
    assert wrong.status_code == 401, "an unreachable Redis must not 500 the login"

    ok = await _login(client, PASSWORD)
    assert ok.status_code == 200, ok.text


async def test_redis_outage_falls_back_to_the_in_process_counter(
    client, registered_user, redis_backend
):
    """Fail-open is not fail-unlimited: the local counter keeps throttling."""
    redis_backend.fail = True

    codes = await _fail_login(client, _BACKOFF_MAX_FAILURES)
    assert codes == [401] * _BACKOFF_MAX_FAILURES
    assert (await _login(client, PASSWORD)).status_code == 429
