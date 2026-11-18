"""Admin endpoints need a second factor (``REQUIRE_ADMIN_2FA``).

An admin reaches the user list, page permissions, the audit log and the camera
console, so a password alone is not enough for that role. Enforcement stops at
the admin API on purpose: the session keeps working, so the admin can still open
Profile → Security and turn 2FA on instead of being locked out of the only way
to comply.
"""

import pytest

from app.core.config import settings

PASSWORD = "SecretPass123"


@pytest.fixture(autouse=True)
def _enforce_admin_2fa(monkeypatch):
    """The suite disables the gate by default; this module is what it protects."""
    monkeypatch.setattr(settings, "REQUIRE_ADMIN_2FA", True)


async def _login(client, email: str) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    token = client.cookies.get("csrf_token")
    if token:
        client.headers["X-CSRF-Token"] = token


async def test_admin_without_2fa_is_refused_the_admin_api(client, make_user):
    await make_user(email="admin-plain@example.com", password=PASSWORD, role="admin")
    await _login(client, "admin-plain@example.com")

    response = await client.get("/api/v1/users/pending")
    assert response.status_code == 403
    assert "2FA" in response.json()["detail"]


async def test_blocked_admin_can_still_reach_the_setup_path(client, make_user):
    await make_user(email="admin-setup@example.com", password=PASSWORD, role="admin")
    await _login(client, "admin-setup@example.com")

    # The way out of the 403 has to stay open, or enforcement is a lockout.
    assert (await client.get("/api/v1/profile/me")).status_code == 200
    assert (await client.get("/api/v1/auth/2fa/status")).status_code == 200
    assert (await client.post("/api/v1/auth/2fa/setup")).status_code == 200


async def test_admin_with_2fa_uses_the_admin_api(client, logged_in_admin_user):
    assert (await client.get("/api/v1/users/pending")).status_code == 200


async def test_policy_can_be_switched_off(client, make_user, monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_ADMIN_2FA", False)
    await make_user(email="admin-off@example.com", password=PASSWORD, role="admin")
    await _login(client, "admin-off@example.com")

    assert (await client.get("/api/v1/users/pending")).status_code == 200


async def test_members_still_get_the_plain_refusal(client, logged_in_user):
    response = await client.get("/api/v1/users/pending")
    assert response.status_code == 403
    assert response.json()["detail"] == "Not enough permissions"
