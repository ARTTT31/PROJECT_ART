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


async def test_revoke_unknown_session_returns_404(client, logged_in_admin_user):
    resp = await client.delete("/api/v1/users/sessions/does-not-exist")
    assert resp.status_code == 404
