"""Regression tests for the avatar endpoints (T8).

``POST /profile/avatar`` accepted ANY string (including ``javascript:alert(1)``
and multi-megabyte blobs) straight into the users table. It is removed;
``/profile/upload-avatar`` remains the only way to set an avatar and already
sniffs magic bytes + caps the upload at 1MB.
"""


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
    # 1x1 transparent PNG, real magic bytes.
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x08"
        b"\x08\x06\x00\x00\x00\xcc/\xa1\x18\x00\x00\x00\x0cIDATx\x9c\x02\x8c"
        b"\x9b\xe3\xe4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    r = await client.post(
        "/api/v1/profile/upload-avatar",
        files={"file": ("tiny.png", png, "image/png")},
    )
    assert r.status_code == 200
