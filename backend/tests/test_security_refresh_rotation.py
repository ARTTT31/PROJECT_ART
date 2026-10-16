"""Regression tests for refresh-token rotation and reuse detection (T19).

Before this change a refresh token stayed valid forever: rotating it produced a
new pair but the old token kept working, so a stolen copy outlived every logout.
Now the session records which ``jti`` it accepts, a rotated-away token is a
replay that revokes the session (the one exception being a second tab
refreshing inside the grace window), and tokens without a ``sid`` — which have
no session to revoke — are refused outright.

Tokens are read from the individual response's Set-Cookie header rather than
the client jar: the tests deliberately put old and new values in play at once.
"""

from datetime import timedelta

import jwt as pyjwt
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import decode_token
from app.core.utils import utcnow
from app.models.session import UserSession
from app.services.auth_service import REFRESH_GRACE_SECONDS

EMAIL = "rotate@example.com"
PASSWORD = "Passw0rd123"


async def _login(client, email=EMAIL):
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": PASSWORD, "name": "Rotator"})
    resp = await client.post("/api/v1/auth/login", json={
        "email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    # Cookie-authenticated writes need the double-submit CSRF token.
    csrf = resp.cookies.get("csrf_token")
    if not csrf:
        csrf = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf
    return resp


async def _session_row(db_session, session_id: str) -> UserSession:
    return (
        await db_session.execute(
            select(UserSession).where(UserSession.session_id == session_id)
        )
    ).scalar_one()


async def test_refresh_rotates_the_refresh_jti(client, db_session):
    login = await _login(client)
    session_id = login.json()["data"]["session_id"]
    first_jti = decode_token(login.cookies.get("refresh_token"))["jti"]

    rotated = await client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200, rotated.text

    second_jti = decode_token(rotated.cookies.get("refresh_token"))["jti"]
    assert second_jti != first_jti, "rotation must issue a new jti"

    row = await _session_row(db_session, session_id)
    assert row.refresh_jti == second_jti
    assert row.prev_refresh_jti == first_jti
    assert row.rotated_at is not None

    # The rotated pair still authenticates.
    assert (await client.get("/api/v1/profile/me")).status_code == 200


async def test_replay_outside_the_grace_window_revokes_the_session(client, db_session):
    login = await _login(client)
    session_id = login.json()["data"]["session_id"]
    stolen = login.cookies.get("refresh_token")

    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    live = refreshed.cookies.get("refresh_token")

    # Age the rotation past the grace window: the old token is now a replay.
    row = await _session_row(db_session, session_id)
    row.rotated_at = utcnow() - timedelta(seconds=REFRESH_GRACE_SECONDS + 1)
    await db_session.commit()

    client.cookies.clear()
    replay = await client.post("/api/v1/auth/refresh", json={"refresh_token": stolen})
    assert replay.status_code == 401, replay.text

    await db_session.refresh(row)
    assert row.is_active is False, "a replayed refresh token must kill the session"

    # The session stays dead: the newest token cannot refresh either.
    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": live})
    ).status_code == 401


async def test_concurrent_refresh_inside_the_grace_window_succeeds(client, db_session):
    """Two tabs refreshing at the same moment must not log the user out."""
    login = await _login(client)
    session_id = login.json()["data"]["session_id"]
    first = login.cookies.get("refresh_token")

    rotated = await client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    live = rotated.cookies.get("refresh_token")
    live_jti = decode_token(live)["jti"]

    # The second tab still only has the pre-rotation token and refreshes too.
    client.cookies.clear()
    concurrent = await client.post("/api/v1/auth/refresh", json={"refresh_token": first})
    assert concurrent.status_code == 200, concurrent.text

    converged_token = concurrent.cookies.get("refresh_token")
    assert decode_token(converged_token)["jti"] == live_jti, (
        "both tabs must converge on the current jti"
    )

    row = await _session_row(db_session, session_id)
    assert row.refresh_jti == live_jti
    assert row.is_active is True

    # Converging is not the same as being stuck: the token still rotates onward.
    client.cookies.clear()
    again = await client.post("/api/v1/auth/refresh", json={"refresh_token": converged_token})
    assert again.status_code == 200, again.text
    assert decode_token(again.cookies.get("refresh_token"))["jti"] != live_jti


async def test_refresh_token_without_a_sid_is_refused(client, registered_user):
    """Legacy tokens have no session to check or revoke — no sid, no access."""
    from app.core.security import create_refresh_token

    legacy_shape = create_refresh_token(
        data={"sub": "test@example.com", "user_id": 1}
    )

    client.cookies.clear()
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": legacy_shape}
    )
    assert resp.status_code == 401, resp.text


async def test_last_pre_deploy_token_upgrades_the_session_once(client, db_session):
    """The rollout path: one jti-less token is accepted, then the row is upgraded.

    Tokens issued before this change carry no ``jti`` at all and their session
    has no ``refresh_jti``, so the first refresh has to be accepted — once,
    after which the token is rotated away and a second use is a replay.
    """
    login = await _login(client)
    session_id = login.json()["data"]["session_id"]
    user_id = login.json()["data"]["user"]["id"]

    row = await _session_row(db_session, session_id)
    row.refresh_jti = None
    row.prev_refresh_jti = None
    row.rotated_at = None
    await db_session.commit()

    now = utcnow()
    pre_deploy = pyjwt.encode(
        {
            "sub": EMAIL,
            "user_id": user_id,
            "sid": session_id,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=1),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    assert "jti" not in decode_token(pre_deploy)

    client.cookies.clear()
    upgraded = await client.post("/api/v1/auth/refresh", json={"refresh_token": pre_deploy})
    assert upgraded.status_code == 200, upgraded.text

    await db_session.refresh(row)
    assert row.refresh_jti is not None, "the session must be upgraded to the jti scheme"

    # Present the same pre-deploy token again (the rotated cookie is dropped so
    # the body value is the one under test — the cookie wins when both exist).
    client.cookies.clear()
    assert (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": pre_deploy})
    ).status_code == 401
    await db_session.refresh(row)
    assert row.is_active is False


async def test_logout_still_revokes_the_rotated_session(client, registered_user):
    """Rotation must not weaken the existing logout revocation path."""
    login = await _login(client)
    session_id = login.json()["data"]["session_id"]
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200

    logout = await client.post(
        "/api/v1/auth/logout", params={"session_id": session_id}
    )
    assert logout.status_code == 200, logout.text

    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
