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
