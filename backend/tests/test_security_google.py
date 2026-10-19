"""Regression tests for /auth/google/verify-token (T2).

Guarantees that Google tokens issued to OTHER OAuth clients cannot be used to
log into this app: the token audience must match the configured
GOOGLE_VALID_CLIENT_IDS, and an unconfigured client-ID list must fail closed.
"""

import app.api.v1.endpoints.auth as auth_mod
from app.core.config import settings


def _fake_google(payload):
    """Build the fake google-auth objects monitored by the endpoint."""

    class G:
        @staticmethod
        def verify_oauth2_token(tok, req, *a, **k):
            return payload

    return G


async def test_google_foreign_audience_rejected(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_VALID_CLIENT_IDS", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(auth_mod, "_GOOGLE_AUTH_AVAILABLE", True)
    monkeypatch.setattr(
        auth_mod,
        "google_id_token",
        _fake_google({
            "aud": "attacker.apps.googleusercontent.com",
            "email": "ceo@company.com",
            "email_verified": True,
            "name": "CEO",
        }),
    )
    monkeypatch.setattr(
        auth_mod, "google_requests", type("R", (), {"Request": staticmethod(lambda: None)})
    )
    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 401


async def test_google_missing_client_id_config_fails_closed(client, monkeypatch):
    """Empty GOOGLE_VALID_CLIENT_IDS must never skip the audience check."""
    monkeypatch.delenv("GOOGLE_VALID_CLIENT_IDS", raising=False)
    monkeypatch.setattr(auth_mod, "_get_valid_client_ids", lambda: [])
    monkeypatch.setattr(auth_mod, "_GOOGLE_AUTH_AVAILABLE", True)
    monkeypatch.setattr(
        auth_mod,
        "google_id_token",
        _fake_google({
            "aud": "some.apps.googleusercontent.com",
            "email": "ceo@company.com",
            "email_verified": True,
            "name": "CEO",
        }),
    )
    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code != 200


async def test_google_matching_audience_still_works(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_VALID_CLIENT_IDS", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(auth_mod, "_GOOGLE_AUTH_AVAILABLE", True)
    # This is a first sign-in for the address, so the account has to be created:
    # closed mode answers 403 before any of the audience logic runs.
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(
        auth_mod,
        "google_id_token",
        _fake_google({
            "aud": "legit.apps.googleusercontent.com",
            "email": "newuser@example.com",
            "email_verified": True,
            "name": "New User",
        }),
    )
    monkeypatch.setattr(
        auth_mod, "google_requests", type("R", (), {"Request": staticmethod(lambda: None)})
    )
    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 200
    assert r.json()["result"] == "success"


async def test_google_access_token_login_removed(client, monkeypatch):
    """The unprotected access_token/userinfo login path must not exist anymore."""
    monkeypatch.setenv("GOOGLE_VALID_CLIENT_IDS", "legit.apps.googleusercontent.com")
    r = await client.post("/api/v1/auth/google/verify-token", json={"access_token": "ya29.abc"})
    assert r.status_code != 200
