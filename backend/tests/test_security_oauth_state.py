"""Regression tests for the Google OAuth state parameter (T6).

The OAuth authorization-code flow must carry a server-generated ``state``
through a short-lived HttpOnly cookie and verify it via compare_digest in the
callback, otherwise the callback is open to login CSRF (an attacker can force
a victim into the attacker's Google session).
"""

import pytest

from app.core.config import settings

import app.api.v1.endpoints.auth as auth_mod


@pytest.fixture
def google_client_id(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "legit.apps.googleusercontent.com")
    return "legit.apps.googleusercontent.com"


async def test_google_login_issues_state_cookie_and_param(client, google_client_id):
    r = await client.get("/api/v1/auth/google", follow_redirects=False)
    assert r.status_code in (301, 302, 307)

    location = r.headers["location"]
    assert "state=" in location, "authorization URL must carry a state parameter"

    set_cookie = r.headers.get("set-cookie", "")
    assert "oauth_state" in set_cookie, "the state must be stored in a cookie"
    assert "httponly" in set_cookie.lower()


async def test_google_callback_missing_state_rejected(client, monkeypatch, google_client_id):
    """No state cookie / param: 400 and the code is never exchanged."""

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")

    class Boom:
        def __init__(self, *a, **k):
            raise AssertionError("callback must NOT exchange the code before validating state")

        def __aenter__(self):
            raise AssertionError("callback must NOT exchange the code before validating state")

    monkeypatch.setattr(auth_mod, "httpx", type("H", (), {"AsyncClient": Boom}))

    r = await client.get("/api/v1/auth/google/callback?code=attacker-code")
    assert r.status_code == 400


async def test_google_callback_wrong_state_rejected(client, monkeypatch, google_client_id):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")

    class Boom:
        def __aenter__(self):
            raise AssertionError("callback must NOT exchange the code before validating state")

    monkeypatch.setattr(auth_mod, "httpx", type("H", (), {"AsyncClient": Boom}))

    client.cookies.set("oauth_state", "legit-state")
    r = await client.get("/api/v1/auth/google/callback?code=attacker-code&state=forged-state")
    assert r.status_code == 400
