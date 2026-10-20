"""Tests for Company/Team Branding endpoints in system.py"""

import pytest


@pytest.mark.asyncio
async def test_get_branding_is_public(client):
    """Anonymous visitors can get the current workspace/company branding."""
    resp = await client.get("/api/v1/system/branding")
    assert resp.status_code == 200
    data = resp.json()
    assert "company_name" in data
    assert data["company_name"] == "ART Workspace"
    assert "company_tagline" in data


@pytest.mark.asyncio
async def test_update_branding_requires_auth(client):
    """Anonymous callers cannot update branding."""
    resp = await client.put(
        "/api/v1/system/branding",
        json={"company_name": "New Team Name"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_branding_requires_admin(client, logged_in_user):
    """Normal non-admin users cannot update branding (403)."""
    resp = await client.put(
        "/api/v1/system/branding",
        json={"company_name": "Unauthorized Team Name"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_update_branding(client, logged_in_admin_user):
    """Admin can update company/team name and tagline."""
    # Ensure CSRF token header
    csrf_token = client.cookies.get("csrf_token")
    if not csrf_token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        csrf_token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf_token

    payload = {
        "company_name": "ทีมพัฒนา ART Core",
        "company_tagline": "ศูนย์รวมเครื่องมือและแดชบอร์ดส่วนกลาง",
        "brand_logo_url": "https://example.com/logo.png",
    }
    resp = await client.put("/api/v1/system/branding", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_name"] == "ทีมพัฒนา ART Core"
    assert data["company_tagline"] == "ศูนย์รวมเครื่องมือและแดชบอร์ดส่วนกลาง"
    assert data["brand_logo_url"] == "https://example.com/logo.png"

    # Verify public GET reflects updated branding
    client.cookies.clear()
    client.headers.pop("X-CSRF-Token", None)
    get_resp = await client.get("/api/v1/system/branding")
    assert get_resp.status_code == 200
    assert get_resp.json()["company_name"] == "ทีมพัฒนา ART Core"


@pytest.mark.asyncio
async def test_update_branding_validates_name(client, logged_in_admin_user):
    """Empty company_name is rejected with 422."""
    csrf_token = client.cookies.get("csrf_token")
    if not csrf_token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        csrf_token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf_token

    resp = await client.put("/api/v1/system/branding", json={"company_name": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_branding_reports_the_policy_the_register_endpoint_enforces(client):
    """Both public surfaces must describe the same registration policy.

    They used to disagree: branding defaulted to ``approval`` while the
    registration endpoint fell back to ``closed``, so the sign-up form appeared
    and then every submission was refused.
    """
    branding = (await client.get("/api/v1/system/branding")).json()
    policy = (await client.get("/api/v1/auth/registration-mode")).json()

    assert branding["registration_mode"] == policy["data"]["registration_mode"]
    assert branding["registration_mode"] == "closed"


@pytest.mark.asyncio
async def test_admin_can_switch_registration_mode_and_signups_follow(
    client, logged_in_admin_user
):
    """Saving ``approval`` in the branding form must enable the approval queue.

    This is the recovery path for a database whose ``registration_mode`` seed is
    missing: the admin can choose the policy from the UI without a redeploy.
    """
    csrf_token = client.cookies.get("csrf_token")
    if not csrf_token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        csrf_token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf_token

    saved = await client.put(
        "/api/v1/system/branding",
        json={"company_name": "ART Workspace", "registration_mode": "approval"},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["registration_mode"] == "approval"

    policy = await client.get("/api/v1/auth/registration-mode")
    assert policy.json()["data"]["registration_mode"] == "approval"

    client.cookies.clear()
    client.headers.pop("X-CSRF-Token", None)
    signup = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "from-branding@example.com",
            "password": "Passw0rd123",
            "name": "From Branding",
            "accepted_terms": True,
        },
    )
    assert signup.status_code == 201, signup.text
    assert signup.json()["data"]["status"] == "pending"


@pytest.mark.asyncio
async def test_branding_rejects_an_unknown_registration_mode(client, logged_in_admin_user):
    """A typo must be a validation error, not a silently ignored field."""
    csrf_token = client.cookies.get("csrf_token")
    if not csrf_token:
        csrf_resp = await client.get("/api/v1/auth/csrf")
        csrf_token = csrf_resp.json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf_token

    resp = await client.put(
        "/api/v1/system/branding",
        json={"company_name": "ART Workspace", "registration_mode": "sometimes"},
    )
    assert resp.status_code == 422
    assert "closed, approval" in resp.text
