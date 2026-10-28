"""Tests for the per-user workspace branding endpoints (/profile/workspace-branding)."""

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
async def test_workspace_branding_requires_auth(client):
    """Anonymous callers cannot read or write personal branding."""
    assert (await client.get("/api/v1/profile/workspace-branding")).status_code == 401
    # A mutating call without a CSRF token is refused by the CSRF middleware
    # before authentication ever runs, so 403 is the correct answer there.
    assert (
        await client.put(
            "/api/v1/profile/workspace-branding", json={"workspace_name": "ของฉัน"}
        )
    ).status_code in (401, 403)


@pytest.mark.asyncio
async def test_user_sets_and_clears_their_own_name(client, logged_in_user):
    """A normal (non-admin) account can personalise its own workspace name."""
    csrf = await _csrf_header(client)

    saved = await client.put(
        "/api/v1/profile/workspace-branding",
        json={"workspace_name": "ทีมของฉัน", "workspace_tagline": "งานส่วนตัว"},
        headers=csrf,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["workspace_name"] == "ทีมของฉัน"
    assert saved.json()["workspace_tagline"] == "งานส่วนตัว"

    fetched = await client.get("/api/v1/profile/workspace-branding")
    assert fetched.json()["workspace_name"] == "ทีมของฉัน"

    # An empty string clears the override so the account falls back to the
    # workspace-wide branding again.
    cleared = await client.put(
        "/api/v1/profile/workspace-branding", json={"workspace_name": ""}, headers=csrf
    )
    assert cleared.status_code == 200
    assert cleared.json()["workspace_name"] == ""
    assert cleared.json()["workspace_tagline"] == "งานส่วนตัว"


@pytest.mark.asyncio
async def test_personal_branding_does_not_touch_the_global_branding(client, logged_in_user):
    """Personalising a view must not rename the workspace for everybody."""
    before = (await client.get("/api/v1/system/branding")).json()["company_name"]

    await client.put(
        "/api/v1/profile/workspace-branding",
        json={"workspace_name": "ชื่อส่วนตัว"},
        headers=await _csrf_header(client),
    )

    after = (await client.get("/api/v1/system/branding")).json()["company_name"]
    assert after == before


@pytest.mark.asyncio
async def test_user_uploads_their_own_logo(client, logged_in_user):
    """A normal account can upload a logo that is only stored on its own row."""
    resp = await client.post(
        "/api/v1/profile/workspace-branding/logo",
        files={"file": ("logo.png", _png_bytes(), "image/png")},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 200, resp.text
    logo = resp.json()["workspace_logo"]
    assert logo.startswith("data:image/webp;base64,")

    # The global branding is untouched.
    global_logo = (await client.get("/api/v1/system/branding")).json()["brand_logo_url"]
    assert global_logo != logo


@pytest.mark.asyncio
async def test_user_logo_upload_rejects_non_images(client, logged_in_user):
    """The same magic-byte guard as the global logo applies per user."""
    resp = await client.post(
        "/api/v1/profile/workspace-branding/logo",
        files={"file": ("logo.png", b"<script>alert(1)</script>", "image/png")},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 400, resp.text


@pytest.mark.asyncio
async def test_workspace_logo_url_scheme_is_validated(client, logged_in_user):
    """A javascript: logo would be rendered by the UI, so it is refused."""
    resp = await client.put(
        "/api/v1/profile/workspace-branding",
        json={"workspace_logo": "javascript:alert(1)"},
        headers=await _csrf_header(client),
    )
    assert resp.status_code == 422, resp.text
