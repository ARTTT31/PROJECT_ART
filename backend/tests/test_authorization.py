"""Authorization: who may call what, and on whose data.

Three classes of mistake are covered here, because each one has bitten a
multi-user dashboard before:

- **Missing authentication** — an endpoint that forgets its dependency answers
  anonymous callers.
- **IDOR** — an endpoint trusts a client-supplied id and acts on somebody else's
  row (here: revoking another account's session).
- **Mass assignment** — a self-service endpoint accepts a field that carries
  authorization (``role``, ``is_active``, ``is_locked``, ``accessible_pages``)
  and lets the caller promote themselves.

Page access is checked here too: the sidebar only *hides* a page it does not
grant, so the server has to refuse the API behind it.
"""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.api.dependencies import DEFAULT_PAGES, parse_accessible_pages
from app.core.utils import utcnow
from app.models.session import UserSession
from app.models.user import User

PASSWORD = "SecretPass123"

# Every endpoint that must not answer an anonymous caller. The admin ones are
# listed separately because they must also refuse a signed-in non-admin.
PROTECTED_GETS = [
    "/api/v1/profile/me",
    "/api/v1/profile/sessions",
    "/api/v1/users/",
    "/api/v1/users/deleted",
    "/api/v1/users/pending",
    "/api/v1/audit/",
    "/api/v1/system/health",
]

ADMIN_ONLY_GETS = [
    "/api/v1/users/",
    "/api/v1/users/deleted",
    "/api/v1/users/pending",
    "/api/v1/audit/",
    "/api/v1/system/health",
]


async def _login(client, email, password=PASSWORD):
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        token = client.cookies.get("csrf_token")
        if not token:
            token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
        client.headers["X-CSRF-Token"] = token
    return resp


@pytest.mark.parametrize("path", PROTECTED_GETS)
async def test_anonymous_callers_are_rejected(client, path):
    resp = await client.get(path)

    assert resp.status_code == 401, f"{path} must not answer anonymous callers: {resp.text}"


@pytest.mark.parametrize("path", ADMIN_ONLY_GETS)
async def test_a_plain_user_is_forbidden_on_admin_endpoints(client, logged_in_user, path):
    resp = await client.get(path)

    assert resp.status_code == 403, f"{path} must be admin-only: {resp.text}"


# ── IDOR ────────────────────────────────────────────────────────────────


async def test_a_user_can_only_revoke_their_own_session(
    client, db_session, make_user, logged_in_user
):
    victim = await make_user(email="victim.sessions@example.com")
    db_session.add(
        UserSession(
            session_id="victim-session-1",
            user_id=victim.id,
            refresh_jti="victim-jti",
            expires_at=utcnow() + timedelta(days=7),
        )
    )
    await db_session.commit()

    stolen = await client.delete("/api/v1/profile/sessions/victim-session-1")

    assert stolen.status_code == 404, "another account's session id must not be actionable"
    row = (
        await db_session.execute(
            select(UserSession).where(UserSession.session_id == "victim-session-1")
        )
    ).scalar_one()
    assert row.is_active is True, "the victim's session must survive the attempt"

    # The endpoint is not merely refusing everything: your own session still works.
    own = logged_in_user["data"]["session_id"]
    assert (await client.delete(f"/api/v1/profile/sessions/{own}")).status_code == 200
    client.cookies.clear()
    client.headers.pop("X-CSRF-Token", None)


# ── mass assignment ─────────────────────────────────────────────────────


async def test_self_service_profile_cannot_change_authorization_fields(
    client, db_session, logged_in_user
):
    """``PUT /profile/me`` is not a way to promote yourself."""
    resp = await client.put(
        "/api/v1/profile/me",
        json={
            "name": "Renamed",
            "role": "admin",
            "is_active": False,
            "is_locked": True,
            "accessible_pages": '["dashboard"]',
        },
    )

    assert resp.status_code == 200, resp.text

    user = (
        await db_session.execute(select(User).where(User.email == "test@example.com"))
    ).scalar_one()
    await db_session.refresh(user)
    assert user.name == "Renamed", "a harmless field must still be saved"
    assert user.role == "user", "role is not self-service"
    assert user.is_active is True, "an account cannot suspend itself into a lockout"
    assert user.is_locked is False
    assert parse_accessible_pages(user.accessible_pages) != ["dashboard"]


# ── page access ─────────────────────────────────────────────────────────


async def test_camera_config_requires_the_camera_page(client, make_user):
    """Hiding the menu entry is not authorization."""
    await make_user(email="no.camera@example.com", accessible_pages='["dashboard", "profile"]')
    assert (await _login(client, "no.camera@example.com")).status_code == 200

    resp = await client.post("/api/v1/profile/camera-config", json={"camera_config": "[]"})

    assert resp.status_code == 403, resp.text
    assert "ไม่มีสิทธิ์เข้าถึงหน้านี้" in resp.json()["detail"]


async def test_camera_config_works_for_an_account_that_has_the_page(client, make_user):
    await make_user(
        email="has.camera@example.com",
        accessible_pages='["dashboard", "profile", "camera"]',
    )
    assert (await _login(client, "has.camera@example.com")).status_code == 200

    resp = await client.post("/api/v1/profile/camera-config", json={"camera_config": "[]"})

    assert resp.status_code == 200, resp.text


async def test_null_page_list_keeps_the_default_and_excludes_camera(client, make_user):
    """A pre-column account must not silently gain every new page."""
    await make_user(email="legacy@example.com", accessible_pages=None)
    assert (await _login(client, "legacy@example.com")).status_code == 200

    resp = await client.post("/api/v1/profile/camera-config", json={"camera_config": "[]"})

    assert resp.status_code == 403, resp.text
    assert "camera" not in DEFAULT_PAGES


async def test_an_admin_is_never_gated_by_the_page_list(client, make_user):
    await make_user(
        email="admin.nopages@example.com", role="admin", accessible_pages='["dashboard"]'
    )
    assert (await _login(client, "admin.nopages@example.com")).status_code == 200

    resp = await client.post("/api/v1/profile/camera-config", json={"camera_config": "[]"})

    assert resp.status_code == 200, resp.text


async def test_the_account_surface_stays_open_to_every_signed_in_account(client, make_user):
    """The gate must not lock a user out of their own profile and sessions."""
    await make_user(email="thin@example.com", accessible_pages='["dashboard"]')
    assert (await _login(client, "thin@example.com")).status_code == 200

    assert (await client.get("/api/v1/profile/me")).status_code == 200
    assert (await client.get("/api/v1/profile/sessions")).status_code == 200
