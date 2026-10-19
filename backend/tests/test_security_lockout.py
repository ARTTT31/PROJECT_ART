"""Regression test for admin manual lock handling at login (T4).

An admin-set lock (is_locked=True with no locked_until) must be honored:
previously the login flow interpreted a missing locked_until as "lock expired"
and silently unlocked the account.
"""

from app.models.user import User
from sqlalchemy.future import select

from conftest import seed_account


async def _locked_account(db_session, email):
    """Seed a locked account (self-registration is closed by default)."""
    user = await seed_account(db_session, email, "Passw0rd123", name="V")
    user.is_locked = True
    user.locked_until = None  # manual admin lock, no automatic expiry
    await db_session.commit()


async def test_admin_manual_lock_blocks_login(client, db_session):
    await _locked_account(db_session, "locked@example.com")
    r = await client.post("/api/v1/auth/login", json={
        "email": "locked@example.com", "password": "Passw0rd123"})
    assert r.status_code == 403, "manually locked account must not log in"
    assert "ล็อก" in r.json()["detail"] or "locked" in r.json()["detail"].lower()


async def test_automated_lock_expires_and_unlocks(client, db_session):
    """A time-boxed lock whose expiry has passed keeps unlocking normally."""
    from datetime import datetime, timedelta, timezone

    await _locked_account(db_session, "timed@example.com")
    result = await db_session.execute(
        select(User).where(User.email == "timed@example.com")
    )
    user = result.scalar_one()
    user.locked_until = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        minutes=1
    )
    await db_session.commit()

    r = await client.post("/api/v1/auth/login", json={
        "email": "timed@example.com", "password": "Passw0rd123"})
    assert r.status_code == 200
