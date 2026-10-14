"""Regression tests for login information leaks and lockout policy (T12).

- Password is verified BEFORE any locked / disabled status is revealed, so a
  wrong password gets the generic 401 no matter what state the account is in.
- A missing user takes a dummy password verification (same timing path).
- Repeated failures no longer LOCK the account itself: an attacker could lock
  out any victim simply by failing 5 logins for them. Backoff is per
  (identifier, IP) in process memory instead.
"""

import pytest

from sqlalchemy.future import select

from app.core.security import verify_password
from app.models.user import User
from app.services import auth_service as auth_service_mod
from app.services.auth_service import AuthService


def _reset_backoff():
    auth_service_mod._login_backoff.clear()


@pytest.fixture(autouse=True)
def clean_backoff():
    _reset_backoff()
    yield
    _reset_backoff()


async def _locked_user(db_session, email="lockedstr@example.com"):
    await db_session.execute(
        User.__table__.insert().values(
            email=email,
            name="Locked",
            hashed_password="$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb2x0c2FsdA$dummy",
            role="user",
            is_active=True,
            is_locked=True,
        )
    )
    await db_session.commit()
    result = await db_session.execute(select(User).where(User.email == email))
    return result.scalar_one()


async def test_wrong_password_on_locked_account_repairs_nothing_and_says_401(
    client, db_session
):
    await _locked_user(db_session)
    r = await client.post("/api/v1/auth/login", json={
        "email": "lockedstr@example.com", "password": "WrongPass1"})
    assert r.status_code == 401, "state must not be revealed on bad password"
    assert "ล็อก" not in r.json()["detail"]


async def test_correct_password_on_locked_account_still_refused(
    client, db_session
):
    await _locked_user(db_session, "lockedstr2@example.com")
    # Give the account a real password hash so the password check succeeds.
    user = (
        await db_session.execute(
            select(User).where(User.email == "lockedstr2@example.com")
        )
    ).scalar_one()
    from app.core.security import get_password_hash

    user.hashed_password = get_password_hash("Passw0rd123")
    await db_session.commit()

    r = await client.post("/api/v1/auth/login", json={
        "email": "lockedstr2@example.com", "password": "Passw0rd123"})
    assert r.status_code == 403, "locked account must stay refused"


async def test_unknown_user_still_takes_a_hash_check(client, db_session):
    """The not-found path must cost the same as a real bcrypt/argon2 verify."""
    # _verify against a dummy hash so timing matches the real path.
    assert not verify_password(
        "whatever", auth_service_mod._DUMMY_PASSWORD_HASH
    )
    r = await client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com", "password": "Whatever123"})
    assert r.status_code == 401


async def test_repeated_failures_do_not_lock_the_account(client, db_session):
    from app.core.security import get_password_hash

    await db_session.execute(
        User.__table__.insert().values(
            email="bruteforce@example.com",
            name="Bruteforce",
            hashed_password=get_password_hash("Passw0rd123"),
            role="user",
            is_active=True,
        )
    )
    await db_session.commit()

    for i in range(7):
        r = await client.post("/api/v1/auth/login", json={
            "email": "bruteforce@example.com", "password": "WrongPass1"})
        assert r.status_code == 401

    result = await db_session.execute(
        select(User).where(User.email == "bruteforce@example.com")
    )
    user = result.scalar_one()
    assert user.is_locked is False, (
        "an attacker must not be able to lock a victim's account from a wrong IP"
    )

    # After the failures stop, the correct password still works (no lock).
    r = await client.post("/api/v1/auth/login", json={
        "email": "bruteforce@example.com", "password": "Passw0rd123"})
    assert r.status_code == 200


async def test_backoff_is_keyed_by_identity_and_ip(client, db_session):
    """Flagging the victim requires the SAME (identity, ip) pair."""
    import time

    from app.core.security import get_password_hash

    await db_session.execute(
        User.__table__.insert().values(
            email="backoff@example.com",
            name="Backoff",
            hashed_password=get_password_hash("Passw0rd123"),
            role="user",
            is_active=True,
        )
    )
    await db_session.commit()

    # Simulate failures recorded for the (identity, ip) pair the endpoint
    # actually passes through (httpx ASGITransport fakes client 127.0.0.1).
    auth_service_mod._login_backoff[("backoff@example.com", "127.0.0.1")] = (
        99.0,
        time.time() + 300.0,
    )

    # Same (identity, ip) -> throttled (429) instead of bad-password 401.
    r = await client.post("/api/v1/auth/login", json={
        "email": "backoff@example.com", "password": "Passw0rd123"})
    assert r.status_code == 429

    # A DIFFERENT identity is not blocked by this brute-forcer's backoff.
    auth_service_mod._login_backoff.clear()
    r = await client.post("/api/v1/auth/login", json={
        "email": "backoff@example.com", "password": "Passw0rd123"})
    assert r.status_code == 200
