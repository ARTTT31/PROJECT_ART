"""Who gets emailed around the approval workflow, and when.

A request notifies every active admin; a decision notifies the applicant.
Delivery is best-effort: the API answer never depends on it.
"""

import pytest

from app.core.config import settings
from app.services.email_service import outbox_clear, outbox_messages

PASSWORD = "Passw0rd123"
HOPEFUL_EMAIL = "hopeful@example.com"


@pytest.fixture(autouse=True)
def _console_backend_and_clean_outbox(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    outbox_clear()
    yield
    outbox_clear()


async def _login_admin(client, email="admin@example.com"):
    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecretPass123"}
    )
    assert resp.status_code == 200, resp.text
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    return resp


async def test_a_new_request_emails_every_active_admin(client, make_user, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    await make_user(email="admin@example.com", name="Admin", role="admin")
    await make_user(email="admin2@example.com", name="Admin Two", role="admin")
    # A demoted/deactivated admin must not be bothered.
    await make_user(email="old-admin@example.com", role="admin", is_active=False)

    r = await client.post(
        "/api/v1/auth/register",
        json={
            "email": HOPEFUL_EMAIL,
            "password": PASSWORD,
            "name": "Hopeful",
            "accepted_terms": True,
        },
    )

    assert r.status_code == 201, r.text
    assert len(outbox_messages("admin@example.com")) == 1
    assert len(outbox_messages("admin2@example.com")) == 1
    assert outbox_messages("old-admin@example.com") == []
    # The applicant shares the knowledge: the address is in the admins' message.
    assert HOPEFUL_EMAIL in outbox_messages("admin@example.com")[0]["text"]


async def test_approval_emails_the_applicant(client, make_user, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    applicant = await make_user(
        email=HOPEFUL_EMAIL, name="Hopeful", is_active=False, status="pending"
    )
    await make_user(email="admin@example.com", name="Admin", role="admin")
    await _login_admin(client)
    outbox_clear()  # drop the notification the login-time nothing sent

    r = await client.post(f"/api/v1/users/{applicant.id}/approve")

    assert r.status_code == 200, r.text
    messages = outbox_messages(HOPEFUL_EMAIL)
    assert len(messages) == 1
    assert "อนุมัติ" in messages[0]["subject"]


async def test_rejection_emails_the_applicant(client, make_user, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    applicant = await make_user(
        email=HOPEFUL_EMAIL, name="Hopeful", is_active=False, status="pending"
    )
    await make_user(email="admin@example.com", name="Admin", role="admin")
    await _login_admin(client)
    outbox_clear()

    r = await client.post(f"/api/v1/users/{applicant.id}/reject")

    assert r.status_code == 200, r.text
    messages = outbox_messages(HOPEFUL_EMAIL)
    assert len(messages) == 1
    assert "ผลการพิจารณา" in messages[0]["subject"]
