"""Self-service password reset.

The flow has to be safe against two different mistakes: leaking whether an
address exists (the answer is identical for everyone) and accepting a link
twice or after it expired. Both are pinned here, plus the session revocation
that makes a reset actually end the attacker's stolen session.
"""

import re
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.utils import utcnow
from app.models.email_token import EmailToken
from app.services import account_emails, email_service
from app.services.email_service import outbox_clear, outbox_messages


@pytest.fixture(autouse=True)
def _console_backend_and_clean_outbox(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    outbox_clear()
    yield
    outbox_clear()


def _token_from_outbox(email: str) -> str:
    messages = outbox_messages(email)
    assert messages, f"no email was sent to {email}"
    match = re.search(r"token=([A-Za-z0-9_\-]+)", messages[0]["text"])
    assert match, "the email carries no reset link"
    return match.group(1)


async def test_forgot_password_sends_a_reset_link(client, make_user):
    await make_user(email="forgetful@example.com", name="Forgetful")

    r = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "forgetful@example.com"}
    )

    assert r.status_code == 200, r.text
    token = _token_from_outbox("forgetful@example.com")
    assert token


async def test_unknown_address_gets_the_same_answer_and_no_email(client, make_user):
    r = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "nobody@example.com"}
    )

    assert r.status_code == 200
    assert outbox_messages("nobody@example.com") == [], "nothing may be sent"


async def test_reset_changes_the_password_and_is_single_use(client, make_user):
    await make_user(email="forgetful@example.com", password="OldPass123")
    await client.post("/api/v1/auth/forgot-password", json={"email": "forgetful@example.com"})
    token = _token_from_outbox("forgetful@example.com")

    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "BrandNewPass1"},
    )
    assert r.status_code == 200, r.text

    # The old password is gone and the new one works.
    old = await client.post(
        "/api/v1/auth/login",
        json={"email": "forgetful@example.com", "password": "OldPass123"},
    )
    assert old.status_code == 401
    new = await client.post(
        "/api/v1/auth/login",
        json={"email": "forgetful@example.com", "password": "BrandNewPass1"},
    )
    assert new.status_code == 200

    # The same link can never be used again.
    again = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "ThirdPass1234"},
    )
    assert again.status_code == 400


async def test_expired_token_is_refused(client, db_session, make_user):
    user = await make_user(email="forgetful@example.com")

    # Issue a token directly, then push its expiry into the past.
    raw = await account_emails.issue_token(
        db_session, user.id, account_emails.PURPOSE_PASSWORD_RESET, 30
    )
    row = (
        await db_session.execute(select(EmailToken))
    ).scalars().one()
    row.expires_at = utcnow() - timedelta(minutes=1)
    await db_session.commit()

    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw, "new_password": "Whatever12345"},
    )

    assert r.status_code == 400
    assert "หมดอายุ" in r.json()["detail"]


async def test_reset_revokes_existing_sessions(client, db_session, make_user):
    from app.models.session import UserSession

    await make_user(email="forgetful@example.com", password="OldPass123")
    # A session opened with the old password (the attacker's, in the threat model).
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "forgetful@example.com", "password": "OldPass123"},
    )
    assert login.status_code == 200

    await client.post("/api/v1/auth/forgot-password", json={"email": "forgetful@example.com"})
    token = _token_from_outbox("forgetful@example.com")
    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "BrandNewPass1"},
    )
    assert r.status_code == 200

    remaining = (await db_session.execute(select(UserSession))).scalars().all()
    assert remaining == [], "every session must be revoked by a password reset"


async def test_garbage_token_is_refused(client, make_user):
    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "this-is-not-a-real-token-value", "new_password": "Whatever12345"},
    )

    assert r.status_code == 400


async def test_short_new_password_is_rejected(client, make_user):
    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "abcdefghijklmnop", "new_password": "short"},
    )

    assert r.status_code == 422
