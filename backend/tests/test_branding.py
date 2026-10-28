"""Tests for Company/Team Branding endpoints in system.py"""

import base64
import io

import pytest
from PIL import Image


def _png_bytes(size: tuple[int, int] = (64, 64)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (0, 102, 204)).save(buffer, format="PNG")
    return buffer.getvalue()


async def _csrf_header(client) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    return {"X-CSRF-Token": token}


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


@pytest.mark.asyncio
async def test_brand_logo_upload_requires_admin(client, logged_in_user):
    """Only admins may replace the workspace logo."""
    resp = await client.post(
        "/api/v1/system/branding/logo",
        files={"file": ("logo.png", _png_bytes(), "image/png")},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_admin_can_upload_brand_logo(client, logged_in_admin_user):
    """An uploaded logo is normalised to a small WebP data URL and published."""
    resp = await client.post(
        "/api/v1/system/branding/logo",
        files={"file": ("logo.png", _png_bytes(), "image/png")},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 200, resp.text
    logo = resp.json()["brand_logo_url"]
    assert logo.startswith("data:image/webp;base64,")

    public = await client.get("/api/v1/system/branding")
    assert public.json()["brand_logo_url"] == logo


@pytest.mark.asyncio
async def test_brand_logo_upload_rejects_non_image(client, logged_in_admin_user):
    """Magic-byte sniffing refuses a payload that only claims to be a PNG."""
    resp = await client.post(
        "/api/v1/system/branding/logo",
        files={"file": ("logo.png", b"<script>alert(1)</script>", "image/png")},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 400, resp.text


@pytest.mark.asyncio
async def test_brand_logo_keeps_transparent_background(client, logged_in_admin_user):
    """A transparent PNG logo must not be flattened to a black square."""
    buffer = io.BytesIO()
    Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(buffer, format="PNG")

    resp = await client.post(
        "/api/v1/system/branding/logo",
        files={"file": ("logo.png", buffer.getvalue(), "image/png")},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 200, resp.text

    encoded = resp.json()["brand_logo_url"].split(",", 1)[1]
    with Image.open(io.BytesIO(base64.b64decode(encoded))) as stored:
        assert stored.mode in ("RGBA", "LA"), stored.mode
        assert stored.convert("RGBA").getpixel((0, 0))[3] == 0
