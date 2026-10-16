"""Regression tests for the backend security headers (T22).

Every response carries the hardening headers (nosniff, DENY framing, no
referrer); HSTS is added only outside DEBUG; and the CSP is chosen per path —
`default-src 'none'` for the API, and a policy that actually permits Swagger's
CDN for /docs, /redoc and /openapi.json. The docs policy used to allow only
'self' (plus the Google hosts), which meant the Swagger page rendered blank even
when it was enabled.
"""

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import (
    CSP_HEADER_VALUE,
    CSP_HEADER_VALUE_DOCS,
    DOCS_PATHS,
    CSPMiddleware,
    _csp_for_path,
    app,
)

EXPECTED_HSTS = "max-age=31536000; includeSubDomains"


def _assert_hardening_headers(headers) -> None:
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["referrer-policy"] == "no-referrer"


# ── Normal (API) responses ─────────────────────────────────────────────────


async def test_normal_responses_carry_the_strict_headers(client):
    for path in ("/", "/health", "/health/ready"):
        resp = await client.get(path)
        assert resp.status_code in (200, 503), path
        assert resp.headers["content-security-policy"] == CSP_HEADER_VALUE
        _assert_hardening_headers(resp.headers)


async def test_api_routes_are_locked_down_too(client):
    resp = await client.get("/api/v1/auth/csrf")
    assert resp.status_code == 200
    assert resp.headers["content-security-policy"] == CSP_HEADER_VALUE
    _assert_hardening_headers(resp.headers)


async def test_hsts_is_sent_only_outside_debug(client, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    assert "strict-transport-security" not in (await client.get("/health")).headers

    monkeypatch.setattr(settings, "DEBUG", False)
    resp = await client.get("/health")
    assert resp.headers["strict-transport-security"] == EXPECTED_HSTS


# ── Per-path CSP ───────────────────────────────────────────────────────────


def test_docs_paths_are_the_only_csp_exception():
    for path in DOCS_PATHS:
        assert _csp_for_path(path) == CSP_HEADER_VALUE_DOCS, path

    # FastAPI's OAuth redirect helper lives under /docs/ as well.
    assert _csp_for_path("/docs/oauth2-redirect") == CSP_HEADER_VALUE_DOCS

    for path in ("/", "/health", "/api/v1/profile/me", "/api/v1/users/"):
        assert _csp_for_path(path) == CSP_HEADER_VALUE, path


async def test_swagger_pages_stay_usable_under_the_csp(client):
    """ENABLE_API_DOCS=True must yield working docs, not a CSP-blank page.

    The running app's docs routes are decided at import time, so this drives a
    fresh app built from the same middleware class.
    """
    test_app = FastAPI(
        docs_url="/docs", redoc_url="/redoc", openapi_url="/openapi.json"
    )
    test_app.add_middleware(CSPMiddleware)

    @test_app.get("/api/v1/ping")
    async def ping():
        return {"ok": True}

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="https://testserver.local") as ac:
        docs = await ac.get("/docs")
        assert docs.status_code == 200
        policy = docs.headers["content-security-policy"]
        assert policy == CSP_HEADER_VALUE_DOCS
        assert "https://cdn.jsdelivr.net" in policy, "Swagger's bundle lives on the CDN"
        _assert_hardening_headers(docs.headers)

        redoc = await ac.get("/redoc")
        assert redoc.status_code == 200
        assert redoc.headers["content-security-policy"] == CSP_HEADER_VALUE_DOCS

        schema = await ac.get("/openapi.json")
        assert schema.status_code == 200
        assert schema.headers["content-security-policy"] == CSP_HEADER_VALUE_DOCS

        # ...while the API next to them keeps the strict policy.
        api = await ac.get("/api/v1/ping")
        assert api.status_code == 200
        assert api.headers["content-security-policy"] == CSP_HEADER_VALUE


async def test_running_app_docs_are_not_blocked_when_enabled(client):
    """Same check against the deployed app, when docs are switched on here."""
    if getattr(app, "docs_url", None) is None:
        import pytest

        pytest.skip("docs are disabled in this environment (DEBUG=False, ENABLE_API_DOCS=False)")

    resp = await client.get("/docs")
    assert resp.status_code == 200
    assert resp.headers["content-security-policy"] == CSP_HEADER_VALUE_DOCS
