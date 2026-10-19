"""Regression tests for Google auto-provisioning domain restriction (T13).

Owner policy: Google logins may auto-create an account only for the hosted
domain(s) configured in GOOGLE_ALLOWED_DOMAINS (checked against the email
domain and the token's `hd` claim). Account creation on top of that is governed
by REGISTRATION_MODE, so every test here opts into ``open`` — in the default
``closed`` mode no Google sign-in creates anything, whatever the domain rules
say, and the assertions below would pass for the wrong reason.
"""

import pytest

import app.api.v1.endpoints.auth as auth_mod
from sqlalchemy.future import select

from app.core.config import settings
from app.models.user import User


def _fake_google(payload):
    class G:
        @staticmethod
        def verify_oauth2_token(tok, req, *a, **k):
            return payload

    return G


@pytest.fixture
def google_checks(monkeypatch):
    monkeypatch.setenv("GOOGLE_VALID_CLIENT_IDS", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(auth_mod, "_GOOGLE_AUTH_AVAILABLE", True)
    monkeypatch.setattr(
        auth_mod, "google_requests", type("R", (), {"Request": staticmethod(lambda: None)})
    )


async def test_foreign_domain_cannot_be_provisioned(client, db_session, monkeypatch, google_checks):
    monkeypatch.setenv("GOOGLE_ALLOWED_DOMAINS", "example.co.th")
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(
        auth_mod, "google_id_token",
        _fake_google({
            "aud": "legit.apps.googleusercontent.com",
            "email": "stranger@gmail.com",
            "email_verified": True,
            "name": "Stranger",
        }),
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 403, "provisioning must be restricted to the approved domain"

    rows = await db_session.execute(select(User).where(User.email == "stranger@gmail.com"))
    assert rows.scalars().one_or_none() is None, "no account may be created"


async def test_missing_hd_claim_is_rejected_when_domains_configured(
    client, db_session, monkeypatch, google_checks
):
    """Consumer Gmail carries no `hd` and its domain is not the corp domain."""
    monkeypatch.setenv("GOOGLE_ALLOWED_DOMAINS", "example.co.th")
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(
        auth_mod, "google_id_token",
        _fake_google({
            "aud": "legit.apps.googleusercontent.com",
            "email": "consumer@gmail.com",
            "email_verified": True,
            "name": "Consumer",
        }),
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 403


async def test_allowed_domain_still_provisions(client, db_session, monkeypatch, google_checks):
    monkeypatch.setenv("GOOGLE_ALLOWED_DOMAINS", "example.co.th")
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(
        auth_mod, "google_id_token",
        _fake_google({
            "aud": "legit.apps.googleusercontent.com",
            "email": "staff@example.co.th",
            "email_verified": True,
            "name": "Staff",
            "hd": "example.co.th",
        }),
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 200

    rows = await db_session.execute(select(User).where(User.email == "staff@example.co.th"))
    created = rows.scalars().one_or_none()
    assert created is not None and created.role == "user"


async def test_unconfigured_domain_list_keeps_previous_behaviour(
    client, db_session, monkeypatch, google_checks
):
    """No GOOGLE_ALLOWED_DOMAINS -> historic open provisioning (documented)."""
    monkeypatch.delenv("GOOGLE_ALLOWED_DOMAINS", raising=False)
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(
        auth_mod, "google_id_token",
        _fake_google({
            "aud": "legit.apps.googleusercontent.com",
            "email": "anyone@gmail.com",
            "email_verified": True,
            "name": "Anyone",
        }),
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 200
