import re

import pytest

from app.services.email_service import outbox_clear, outbox_messages
from tests.conftest import TEST_USER_EMAIL, TEST_USER_PASSWORD, _login

pytestmark = pytest.mark.asyncio

NEW_PASSWORD = "new-passw0rd-2026"


def _token_from(message: str) -> str:
    match = re.search(r"reset-password\?token=([A-Za-z0-9_-]+)", message)
    assert match is not None, message
    return match.group(1)


async def test_forgot_password_mails_a_single_use_link(client, registered_user):
    outbox_clear()
    resp = await client.post(
        "/api/v1/auth/forgot-password", json={"email": TEST_USER_EMAIL}
    )
    assert resp.status_code == 200
    assert "หากอีเมลนี้มีบัญชีอยู่" in resp.json()["message"]

    messages = outbox_messages(TEST_USER_EMAIL)
    assert len(messages) == 1
    token = _token_from(messages[0]["text"])

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert reset.status_code == 200

    # The link cannot be redeemed twice.
    again = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert again.status_code == 400


async def test_reset_changes_password_and_signs_every_device_out(client, registered_user):
    old_session = await _login(client, TEST_USER_EMAIL, TEST_USER_PASSWORD)
    assert old_session["result"] == "success"

    outbox_clear()
    await client.post("/api/v1/auth/forgot-password", json={"email": TEST_USER_EMAIL})
    token = _token_from(outbox_messages(TEST_USER_EMAIL)[0]["text"])

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )
    assert reset.status_code == 200

    # The cookie from before the reset is dead.
    me = await client.get("/api/v1/profile/me")
    assert me.status_code == 401

    stale = await client.post(
        "/api/v1/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
    )
    assert stale.status_code == 401

    fresh = await _login(client, TEST_USER_EMAIL, NEW_PASSWORD)
    assert fresh["result"] == "success"


async def test_forgot_password_does_not_reveal_unknown_accounts(client):
    outbox_clear()
    resp = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "nobody@example.com"}
    )
    assert resp.status_code == 200
    assert outbox_messages("nobody@example.com") == []


async def test_forgot_password_is_rate_limited_per_account(client, registered_user):
    outbox_clear()
    await client.post("/api/v1/auth/forgot-password", json={"email": TEST_USER_EMAIL})
    await client.post("/api/v1/auth/forgot-password", json={"email": TEST_USER_EMAIL})
    # One minute cooldown: the second request is accepted but sends nothing.
    assert len(outbox_messages(TEST_USER_EMAIL)) == 1


async def test_reset_rejects_short_passwords(client, registered_user):
    outbox_clear()
    await client.post("/api/v1/auth/forgot-password", json={"email": TEST_USER_EMAIL})
    token = _token_from(outbox_messages(TEST_USER_EMAIL)[0]["text"])

    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "short"},
    )
    assert resp.status_code == 422
