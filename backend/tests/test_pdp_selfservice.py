"""PDPA self-service: data export and account self-deletion.

Export must contain the caller's own data and nothing else; deletion is a
soft delete inside the admin trash window (restorable, auditable), requires
the password again, and can never remove the last usable admin.
"""

from sqlalchemy import select

from app.models.session import UserSession
from app.models.user import User


async def test_export_requires_authentication(client):
    r = await client.get("/api/v1/profile/export")

    assert r.status_code == 401


async def test_export_returns_own_data_as_a_download(client, logged_in_user):
    r = await client.get("/api/v1/profile/export")

    assert r.status_code == 200, r.text
    assert "attachment" in r.headers.get("content-disposition", "")
    body = r.json()
    assert body["account"]["email"] == "test@example.com"
    assert "sessions" in body
    assert "profile" in body


async def test_self_delete_needs_the_password(client, logged_in_user):
    r = await client.request(
        "DELETE", "/api/v1/profile/me", json={"password": "not-the-password"}
    )

    assert r.status_code == 400


async def test_self_delete_soft_deletes_and_revokes_sessions(
    client, db_session, logged_in_user
):
    r = await client.request(
        "DELETE", "/api/v1/profile/me", json={"password": "SecretPass123"}
    )

    assert r.status_code == 200, r.text

    user = (
        await db_session.execute(select(User).where(User.email == "test@example.com"))
    ).scalars().one()
    # Inside the trash window: restorable, hidden, locked out — not purged.
    assert user.deleted_at is not None
    assert user.is_active is False

    sessions = (await db_session.execute(select(UserSession))).scalars().all()
    assert sessions == []

    # The session cookies are cleared with the response.
    assert client.cookies.get("access_token") is None


async def test_deleted_account_cannot_use_old_cookies(client, logged_in_user):
    await client.request(
        "DELETE", "/api/v1/profile/me", json={"password": "SecretPass123"}
    )

    r = await client.get("/api/v1/auth/session")

    assert r.status_code == 401


async def test_last_admin_cannot_delete_themselves(client, logged_in_admin_user):
    r = await client.request(
        "DELETE", "/api/v1/profile/me", json={"password": "SecretPass123"}
    )

    assert r.status_code == 400
    assert "ผู้ดูแลระบบ" in r.json()["detail"]
