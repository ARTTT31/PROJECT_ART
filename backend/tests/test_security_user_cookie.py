"""Regression tests for the readable ``user`` cookie payload (T9).

The cookie previously carried the avatar and quick_links blobs, so a user with
a large base64 avatar produced an (multi-KB, headroom-breaking) Set-Cookie
header. The cookie is a display cache and must hold only id/role/name/email;
the rest is fetched from the API.
"""

from urllib.parse import unquote


async def test_user_cookie_excludes_avatar_and_quick_links(client, logged_in_user):
    auth = logged_in_user
    # logged_in_user logs in as the test user; the response must set the cookie.
    set_cookie_headers = auth.get("detail", "")  # placeholder; header read below

    # Re-login through a fresh client to inspect the raw header cleanly.
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com", "password": "SecretPass123"})
    raw = resp.cookies.get("user")
    from app.core.utils import decode_user_cookie

    data = decode_user_cookie(raw) if raw else {}
    assert set(data.keys()) <= {"id", "email", "name", "role"}, \
        f"user cookie must carry only id/role/name/email: {data.keys()}"
    assert set_cookie_headers is not None  # keep linters calm about the fixture


async def test_user_cookie_stays_small_with_large_avatar(client, db_session):
    """A huge avatar must not leak into (or inflate) the user cookie."""
    from sqlalchemy.future import select
    from app.models.user import User

    await client.post("/api/v1/auth/register", json={
        "email": "bigavatar@example.com", "password": "Passw0rd123", "name": "B"})

    result = await db_session.execute(
        select(User).where(User.email == "bigavatar@example.com")
    )
    user = result.scalar_one()
    user.avatar = "data:image/png;base64," + "A" * 600_000  # ~600KB avatar
    await db_session.commit()

    resp = await client.post("/api/v1/auth/login", json={
        "email": "bigavatar@example.com", "password": "Passw0rd123"})
    assert resp.status_code == 200

    raw = unquote(resp.cookies.get("user") or "")
    assert len(raw) < 2000, (
        f"user cookie header must stay < 2KB with a large avatar (got {len(raw)})"
    )
    from app.core.utils import decode_user_cookie

    data = decode_user_cookie(resp.cookies.get("user") or "") or {}
    assert "avatar" not in data
    assert "quick_links" not in data
