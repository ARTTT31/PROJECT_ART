"""Regression tests for T17/A1: the auth lookup must not pull profile blobs.

``resolve_user_from_token`` runs on EVERY authenticated request but only reads
``is_active`` / ``is_locked`` / ``role``. It used to SELECT the whole row,
dragging a base64 avatar (up to ~1.3MB) and three 100KB JSON blobs through every
request. These tests watch the SQL that actually reaches the driver and cap the
shape of the auth lookup, then prove the endpoints that DO serve those fields
still work (a deferred column that was never loaded raises MissingGreenlet).

The second half covers the avatar upload itself: whatever the client sends is
normalised to a bounded WebP, and a decompression bomb is refused.
"""

import io
from contextlib import contextmanager

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.api.v1.endpoints.profile import (
    AVATAR_MAX_DIMENSION,
    AVATAR_MAX_PIXELS,
    _normalise_avatar_image,
)

PROFILE_COLUMNS = ("avatar", "quick_links", "dashboard_layout", "camera_config")


@contextmanager
def captured_statements():
    """Collect every SQL statement the process executes inside the block.

    Listening on the ``Engine`` class covers every engine the fixtures build
    (each test gets its own throwaway SQLite engine).
    """
    statements: list[str] = []

    def _record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(Engine, "before_cursor_execute", _record)
    try:
        yield statements
    finally:
        event.remove(Engine, "before_cursor_execute", _record)


def _image_bytes(size=(64, 64), fmt="PNG", color=(200, 40, 40)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format=fmt)
    return buffer.getvalue()


# ── The auth lookup stays small ──────────────────────────────────────────────


async def test_auth_lookup_does_not_select_the_large_columns(client, logged_in_user):
    """An auth-only request must not read avatar/JSON blobs out of the users row."""
    with captured_statements() as statements:
        resp = await client.get("/api/v1/profile/sessions")

    assert resp.status_code == 200, resp.text

    user_selects = [s for s in statements if "FROM users" in s]
    assert user_selects, "authentication must still read the users table"
    for statement in user_selects:
        for column in PROFILE_COLUMNS:
            assert column not in statement, (
                f"'{column}' must not be part of the per-request auth lookup: {statement}"
            )


async def test_profile_endpoints_still_serve_the_deferred_columns(client, logged_in_user):
    """The two endpoints that expose the deferred fields must re-select them."""
    upload = await client.post(
        "/api/v1/profile/upload-avatar",
        files={"file": ("wide.png", _image_bytes((1500, 800)), "image/png")},
    )
    assert upload.status_code == 200, upload.text

    links = await client.post(
        "/api/v1/profile/quick-links", json={"quick_links": '["dashboard"]'}
    )
    assert links.status_code == 200, links.text

    me = await client.get("/api/v1/profile/me")
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["avatar"].startswith("data:image/webp;base64,")
    assert body["quick_links"] == '["dashboard"]'

    # /auth/session resolves the user through resolve_user_from_token as well.
    session = await client.get("/api/v1/auth/session")
    assert session.status_code == 200, session.text
    session_user = session.json()["data"]["user"]
    assert session_user["avatar"].startswith("data:image/webp;base64,")
    assert session_user["quick_links"] == '["dashboard"]'


# ── Avatar normalisation ────────────────────────────────────────────────────


def test_upload_is_re_encoded_to_a_bounded_webp():
    result = _normalise_avatar_image(_image_bytes((1200, 400)))

    with Image.open(io.BytesIO(result)) as image:
        assert image.format == "WEBP"
        assert max(image.size) <= AVATAR_MAX_DIMENSION
        assert image.size == (256, 85)  # aspect ratio preserved
    assert len(result) < 100_000, "the stored avatar must not be megabyte-scale"


def test_exif_orientation_is_applied_before_resizing():
    """A portrait photo carrying EXIF orientation must not be stored sideways."""
    exif = Image.Exif()
    exif[0x0112] = 6  # 6 = rotate 90° clockwise
    buffer = io.BytesIO()
    Image.new("RGB", (800, 400), (10, 10, 200)).save(buffer, format="JPEG", exif=exif)

    result = _normalise_avatar_image(buffer.getvalue())

    with Image.open(io.BytesIO(result)) as image:
        # 400x800 after the rotation -> thumbnailed to 128x256 (not 256x128).
        assert image.size == (128, 256)


def test_decompression_bomb_is_refused():
    bomb = _image_bytes((6000, 4000))  # 24MP PNG, ~80KB on the wire
    assert 6000 * 4000 > AVATAR_MAX_PIXELS

    with pytest.raises(HTTPException) as excinfo:
        _normalise_avatar_image(bomb)

    assert excinfo.value.status_code == 400
    assert "พิกเซล" in excinfo.value.detail


def test_undecodable_image_is_refused_with_400():
    """Valid magic bytes with a broken body must be a 400, not a 500."""
    not_really_a_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x08"
        b"\x08\x06\x00\x00\x00\xcc/\xa1\x18\x00\x00\x00\x0cIDATx\x9c\x02\x8c"
        b"\x9b\xe3\xe4\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    with pytest.raises(HTTPException) as excinfo:
        _normalise_avatar_image(not_really_a_png)

    assert excinfo.value.status_code == 400
