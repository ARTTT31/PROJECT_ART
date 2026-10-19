"""Email verification: link issuance, the opt-in login gate, resend.

The gate is deliberately off by default (REQUIRE_EMAIL_VERIFICATION=False):
a deployment whose email backend is not configured yet must not lock new
users out. These tests pin both sides — the gate blocks when switched on, and
stays out of the way when it is not.
"""

import re

import pytest

from app.core.config import settings
from app.services.email_service import outbox_clear, outbox_messages

PASSWORD = "Passw0rd123"
NEW_EMAIL = "fresh@example.com"


@pytest.fixture(autouse=True)
def _console_backend_and_clean_outbox(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    outbox_clear()
    yield
    outbox_clear()


async def _register(client):
    return await client.post(
        "/api/v1/auth/register",
        json={
            "email": NEW_EMAIL,
            "password": PASSWORD,
            "name": "Fresh",
            "accepted_terms": True,
        },
    )


async def _login(client):
    return await client.post(
        "/api/v1/auth/login", json={"email": NEW_EMAIL, "password": PASSWORD}
    )


def _verification_token() -> str:
    messages = outbox_messages(NEW_EMAIL)
    assert messages, "no verification email was sent"
    match = re.search(r"token=([A-Za-z0-9_\-]+)", messages[0]["text"])
    assert match
    return match.group(1)


async def test_open_signup_sends_a_verification_email(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    r = await _register(client)

    assert r.status_code == 201, r.text
    messages = outbox_messages(NEW_EMAIL)
    assert len(messages) == 1
    assert "verify-email?token=" in messages[0]["text"]


async def test_gate_on_blocks_login_until_verified(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)

    assert (await _register(client)).status_code == 201

    blocked = await _login(client)
    assert blocked.status_code == 403
    assert "ยืนยันอีเมล" in blocked.json()["detail"]

    token = _verification_token()
    verified = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verified.status_code == 200

    allowed = await _login(client)
    assert allowed.status_code == 200


async def test_gate_off_lets_unverified_accounts_sign_in(client, monkeypatch):
    """The default: never block anyone while email delivery is unconfigured."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", False)

    assert (await _register(client)).status_code == 201
    assert (await _login(client)).status_code == 200


async def test_verification_link_is_single_use(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    await _register(client)
    token = _verification_token()

    first = await client.post("/api/v1/auth/verify-email", json={"token": token})
    second = await client.post("/api/v1/auth/verify-email", json={"token": token})

    assert first.status_code == 200
    assert second.status_code == 400


async def test_resend_is_generic_and_sends_a_new_link(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    await _register(client)

    r = await client.post(
        "/api/v1/auth/resend-verification", json={"email": NEW_EMAIL}
    )
    assert r.status_code == 200
    assert len(outbox_messages(NEW_EMAIL)) == 2  # original + resend

    # Unknown address: same answer, no mail.
    r = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "nobody@example.com"}
    )
    assert r.status_code == 200
    assert outbox_messages("nobody@example.com") == []


async def test_resend_is_silent_for_an_already_verified_account(client, monkeypatch, make_user):
    await make_user(email="verified@example.com")

    r = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "verified@example.com"}
    )

    assert r.status_code == 200
    assert outbox_messages("verified@example.com") == []
