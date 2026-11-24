import pytest

pytestmark = pytest.mark.asyncio


async def test_session_list_requires_admin(client, logged_in_user):
    resp = await client.get("/api/v1/users/sessions")
    assert resp.status_code == 403


async def test_admin_lists_logged_in_devices(client, logged_in_admin_user):
    resp = await client.get("/api/v1/users/sessions")
    assert resp.status_code == 200

    rows = resp.json()
    assert isinstance(rows, list) and rows
    admin_user = logged_in_admin_user["data"]["user"]
    assert any(row["user_id"] == admin_user["id"] for row in rows)
    assert resp.headers["x-total-count"] == str(len(rows))

    row = rows[0]
    for field in (
        "session_id",
        "email",
        "role",
        "device_label",
        "user_agent",
        "ip_address",
        "last_activity",
    ):
        assert field in row


async def test_admin_search_filters_sessions(client, logged_in_admin_user):
    email = logged_in_admin_user["data"]["user"]["email"]
    resp = await client.get("/api/v1/users/sessions", params={"q": email})
    assert resp.status_code == 200
    assert all(email in (row["email"] or "") for row in resp.json())


async def test_admin_can_force_logout(client, logged_in_admin_user):
    session_id = logged_in_admin_user["data"]["session_id"]

    resp = await client.delete(f"/api/v1/users/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["result"] == "success"

    # The access token is still in the cookie jar; the revoked session makes it
    # unusable on the next request.
    me = await client.get("/api/v1/profile/me")
    assert me.status_code == 401


async def test_self_revoke_leaves_a_sign_out_entry(client, logged_in_admin_user, db_session):
    """Revoking your own session from /admin must show up on /audit.

    The row is written as `LOGOUT` (the action /audit already labels and
    filters on) with the session prefix in its details, so an admin reading the
    log can tell who ended which session and when.
    """
    from sqlalchemy import select
    from app.models.audit_log import AuditLog

    admin = logged_in_admin_user["data"]["user"]
    session_id = logged_in_admin_user["data"]["session_id"]

    resp = await client.delete(f"/api/v1/users/sessions/{session_id}")
    assert resp.status_code == 200

    # Only committed rows survive, exactly like a request-session teardown.
    await db_session.rollback()
    rows = (
        await db_session.execute(select(AuditLog).where(AuditLog.action == "LOGOUT"))
    ).scalars().all()
    mine = [
        row
        for row in rows
        if row.user_id == admin["id"] and session_id[:8] in (row.details or "")
    ]
    assert mine, "self-revoke succeeded but left no LOGOUT entry in the audit trail"
    assert "own session" in (mine[-1].details or "")


async def test_revoking_someone_elses_session_names_who_and_where(
    client, logged_in_admin_user, db_session, make_user
):
    """The audit row must identify the victim, not just their numeric id.

    `audit_logs.user_id` is the admin who acted; the target survives only in
    `details`, which is what /audit's search reads. Name, email and device have
    to be in that text, because the victim's account may be gone later.
    """
    from sqlalchemy import select
    from app.models.audit_log import AuditLog
    from app.models.session import UserSession

    admin_id = logged_in_admin_user["data"]["user"]["id"]
    victim = await make_user("victim.device@example.com", name="Somchai Jaidee")
    db_session.add(
        UserSession(
            session_id="victim-session-1",
            user_id=victim.id,
            device_label="Somchai's iPhone",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
            is_active=True,
        )
    )
    await db_session.commit()

    resp = await client.delete("/api/v1/users/sessions/victim-session-1")
    assert resp.status_code == 200

    await db_session.rollback()
    rows = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action == "ADMIN_REVOKE_SESSION")
        )
    ).scalars().all()
    mine = [row for row in rows if "victim-s" in (row.details or "")]

    assert mine, "revoking another account's session left no ADMIN_REVOKE_SESSION row"
    entry = mine[-1]
    assert entry.user_id == admin_id  # the actor stays the admin
    assert "Somchai Jaidee" in (entry.details or "")
    assert victim.email in (entry.details or "")
    assert "Somchai's iPhone" in (entry.details or "")
    assert entry.target_user_id == victim.id

    # The target is structured in the response too, not just spelled in text.
    page = await client.get(
        "/api/v1/audit/paginated", params={"action": "ADMIN_REVOKE_SESSION"}
    )
    assert page.status_code == 200, page.text
    row = next(
        item
        for item in page.json()["items"]
        if "victim-s" in (item["details"] or "")
    )
    assert row["target_user"]["id"] == victim.id
    assert row["target_user"]["email"] == victim.email
    assert row["user"]["id"] == admin_id


async def test_revoked_session_details_fall_back_to_the_user_agent(
    client, logged_in_admin_user, db_session, make_user
):
    from sqlalchemy import select
    from app.models.audit_log import AuditLog
    from app.models.session import UserSession

    victim = await make_user("victim.ua@example.com", name="No Label")
    db_session.add(
        UserSession(
            session_id="victim-session-2",
            user_id=victim.id,
            user_agent="Mozilla/5.0 (Linux; Android 15) Firefox/141.0",
            is_active=True,
        )
    )
    await db_session.commit()

    assert (
        await client.delete("/api/v1/users/sessions/victim-session-2")
    ).status_code == 200

    await db_session.rollback()
    rows = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action == "ADMIN_REVOKE_SESSION")
        )
    ).scalars().all()
    entry = next(row for row in rows if "victim-s" in (row.details or ""))
    assert "Android 15" in (entry.details or "")


async def test_admin_can_filter_sessions_by_role(client, logged_in_admin_user):
    resp = await client.get("/api/v1/users/sessions", params={"role": "admin"})
    assert resp.status_code == 200
    assert all(row["role"] == "admin" for row in resp.json())


async def test_user_list_reports_active_sessions(client, logged_in_admin_user):
    user_id = logged_in_admin_user["data"]["user"]["id"]
    resp = await client.get("/api/v1/users")
    assert resp.status_code == 200

    row = next(item for item in resp.json() if item["id"] == user_id)
    assert row["active_sessions"] >= 1
    assert "last_login" in row
    assert "last_activity" in row


async def test_user_list_reports_zero_for_stale_sessions(client, logged_in_admin_user, db_session):
    from datetime import timedelta
    from app.core.utils import utcnow
    from app.models.session import UserSession
    from app.api.v1.endpoints.websockets import manager
    from sqlalchemy import update

    user_id = logged_in_admin_user["data"]["user"]["id"]

    # Ensure manager has no lingering WS for this user
    for ws in list(manager.active_connections):
        if manager._owner.get(ws) == user_id:
            manager.disconnect(ws)

    # Set last_activity to 2 hours ago
    stale_time = utcnow() - timedelta(hours=2)
    await db_session.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id)
        .values(last_activity=stale_time)
    )
    await db_session.commit()

    resp = await client.get("/api/v1/users")
    assert resp.status_code == 200
    row = next(item for item in resp.json() if item["id"] == user_id)
    assert row["active_sessions"] == 0
    assert row["last_activity"] is not None


async def test_session_list_reports_is_online(client, logged_in_admin_user):
    resp = await client.get("/api/v1/users/sessions")
    assert resp.status_code == 200
    rows = resp.json()
    assert any(row["is_online"] is True for row in rows)


async def test_revoke_unknown_session_returns_404(client, logged_in_admin_user):
    resp = await client.delete("/api/v1/users/sessions/does-not-exist")
    assert resp.status_code == 404


async def test_session_timestamps_carry_their_utc_offset(client, logged_in_admin_user):
    """Without an offset the browser reads UTC as local time (7 hours off in TH)."""
    admin_rows = (await client.get("/api/v1/users/sessions")).json()
    own_rows = (await client.get("/api/v1/profile/sessions")).json()["data"]

    for row in [*admin_rows, *own_rows]:
        for field in ("last_activity", "created_at"):
            value = row[field]
            if value:
                assert value.endswith(("+00:00", "Z")), f"{field} must be UTC: {value}"
