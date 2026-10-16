"""Regression tests for the avatar endpoints (T8).

``POST /profile/avatar`` accepted ANY string (including ``javascript:alert(1)``
and multi-megabyte blobs) straight into the users table. It is removed;
``/profile/upload-avatar`` remains the only way to set an avatar; it sniffs magic
bytes, caps the upload at 1MB and re-encodes the image (T17/A1).
"""

import io

from PIL import Image


def _real_png() -> bytes:
    """A genuinely decodable PNG.

    The fixture this replaced only had valid magic bytes with a broken body;
    now that the upload is re-encoded it must be a real image. The
    undecodable-payload case lives in ``test_security_profile_columns.py``.
    """
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 200, 10)).save(buffer, format="PNG")
    return buffer.getvalue()


async def test_post_profile_avatar_is_gone(client, logged_in_user):
    """The unsafe endpoint must not exist anymore (404/405, never 200)."""
    r = await client.post("/api/v1/profile/avatar", json={
        "avatar_base64": "data:image/png;base64,iVBORw0KGgo=",
    })
    assert r.status_code in (404, 405), "the raw-base64 avatar endpoint must be removed"


async def test_javascript_payload_not_stored_via_avatar(client, logged_in_user):
    r = await client.post("/api/v1/profile/avatar", json={
        "avatar_base64": "javascript:alert(1)",
    })
    assert r.status_code in (404, 405)
    assert "avatar" not in (r.text or "").lower() or r.status_code != 200


async def test_javascript_payload_rejected_on_upload_avatar(client, logged_in_user):
    """The remaining upload endpoint still refuses non-image content."""
    r = await client.post(
        "/api/v1/profile/upload-avatar",
        files={"file": ("payload.png", b"javascript:alert(1)", "image/png")},
    )
    assert r.status_code == 400


async def test_oversized_upload_rejected(client, logged_in_user):
    payload = b"\x89PNG" + b"A" * (2 * 1024 * 1024)  # 2MB > 1MB cap
    r = await client.post(
        "/api/v1/profile/upload-avatar",
        files={"file": ("big.png", payload, "image/png")},
    )
    assert r.status_code == 400


async def test_valid_png_upload_accepted(client, logged_in_user):
    r = await client.post(
        "/api/v1/profile/upload-avatar",
        files={"file": ("tiny.png", _real_png(), "image/png")},
    )
    assert r.status_code == 200, r.text

    # Stored as a normalised WebP data URL, never the raw upload.
    me = await client.get("/api/v1/profile/me")
    assert me.json()["avatar"].startswith("data:image/webp;base64,")
