"""Regression tests for token-type separation and /auth/session trust (T3).

Guarantees that:
- a refresh token cannot be used as an access token (Bearer auth, /session);
- /auth/session derives its answer from the JWT + DB, never from the client-
  writable ``user`` cookie;
- Google logins create an active UserSession row with ``sid`` in the refresh
  token so logout/revoke works for them too.
"""

import app.api.v1.endpoints.auth as auth_mod
from sqlalchemy.future import select

from app.core.security import decode_token
from app.models.session import UserSession


async def _register_and_login(client, email="u@example.com"):
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": "Passw0rd123", "name": "U"})
    r = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "Passw0rd123"})
    return r


async def test_refresh_token_not_usable_as_access(client):
    r = await _register_and_login(client)
    assert r.status_code == 200
    refresh = r.cookies.get("refresh_token")
    client.cookies.clear()

    r = await client.get("/api/v1/profile/me", headers={"Authorization": f"Bearer {refresh}"})
    # 401 (once logged out, a replayed refresh token cannot read APIs anymore)
    assert r.status_code == 401

    # on /session the refresh token must also be rejected
    client.cookies.set("access_token", refresh)
    r = await client.get("/api/v1/auth/session")
    assert r.status_code == 401


async def test_session_ignores_forged_user_cookie(client):
    r = await _register_and_login(client)
    assert r.status_code == 200
    access = r.cookies.get("access_token")
    client.cookies.clear()

    client.cookies.set("access_token", access)
    client.cookies.set("user", '{"id":1,"email":"admin@art.com","name":"Admin","role":"admin"}')
    r = await client.get("/api/v1/auth/session")
    assert r.status_code == 200
    data = r.json()["data"]["user"]
    assert data["role"] == "user", "session must reflect the DB role, not the cookie"


async def test_google_login_creates_session_row_and_sid(client, db_session, monkeypatch):
    """Google sign-ins get a real UserSession row + sid in the refresh token."""
    monkeypatch.setenv("GOOGLE_VALID_CLIENT_IDS", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(auth_mod, "_GOOGLE_AUTH_AVAILABLE", True)

    class G:
        @staticmethod
        def verify_oauth2_token(tok, req, *a, **k):
            return {"aud": "legit.apps.googleusercontent.com",
                    "email": "googleuser@example.com", "email_verified": True,
                    "name": "Google User"}

    monkeypatch.setattr(auth_mod, "google_id_token", G)
    monkeypatch.setattr(auth_mod, "google_requests",
                        type("R", (), {"Request": staticmethod(lambda: None)}))

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})
    assert r.status_code == 200
    refresh = r.cookies.get("refresh_token")
    payload = decode_token(refresh)
    assert payload.get("sid"), "Google refresh token must carry a session id"

    sessions = await db_session.execute(select(UserSession))
    rows = list(sessions.scalars().all())
    assert rows and any(s.session_id == payload["sid"] for s in rows), (
        "google login must create an active UserSession row"
    )
    assert all(s.is_active for s in rows)
