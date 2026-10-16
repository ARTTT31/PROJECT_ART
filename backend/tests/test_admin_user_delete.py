"""Admin "delete user" tests — verified with foreign keys ENFORCED.

The suite's shared SQLite fixture does not enforce foreign keys, but the
production database (Postgres) does. That difference hid the interesting part
of deleting a user: ``sessions.user_id`` has no ON DELETE rule (so the ORM must
remove those rows) while ``audit_logs.user_id`` is ``ON DELETE SET NULL`` (the
audit trail must survive the account). The engine built here turns
``PRAGMA foreign_keys=ON`` so a failure in that dance fails the test instead of
only appearing on Render.
"""

from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.utils import utcnow
from app.main import app
from app.models.audit_log import AuditLog
from app.models.session import UserSession
from app.models.user import User

ADMIN_EMAIL = "admin.delete@example.com"
VICTIM_EMAIL = "victim.delete@example.com"
PASSWORD = "SecretPass123"
RETENTION_DAYS = settings.USER_DELETE_RETENTION_DAYS


@pytest.fixture
async def fk_env():
    """Yield a session factory whose engine enforces foreign keys."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield session_factory
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


async def _client() -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app), base_url="https://testserver.local"
    )


async def _register(client: AsyncClient, email: str, name: str) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": email, "password": PASSWORD, "name": name})
    assert resp.status_code == 201, resp.text


async def _user_id(session_factory, email: str) -> int:
    async with session_factory() as session:
        return (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one().id


async def _promote_to_admin(session_factory, email: str) -> int:
    async with session_factory() as session:
        user = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one()
        user.role = "admin"
        await session.commit()
        return user.id


async def _login(client: AsyncClient, email: str) -> None:
    resp = await client.post("/api/v1/auth/login", json={
        "email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token


async def _trash(session_factory, user_id: int) -> User | None:
    async with session_factory() as session:
        return (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()


async def test_delete_moves_the_account_to_the_trash_and_revokes_sessions(fk_env):
    """``DELETE`` is now recoverable: the row stays, the access does not."""
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        async with fk_env() as session:
            victim_id = (
                await session.execute(select(User).where(User.email == VICTIM_EMAIL))
            ).scalar_one().id
            assert (await session.execute(
                select(UserSession).where(UserSession.user_id == victim_id)
            )).scalars().all(), "the login must have created a session row"
            assert (await session.execute(
                select(AuditLog).where(AuditLog.user_id == victim_id)
            )).scalars().all(), "the login must have written audit rows for the user"

        resp = await admin_client.delete(f"/api/v1/users/{victim_id}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["result"] == "success"
        assert resp.json()["data"]["purged"] is False

        trashed = await _trash(fk_env, victim_id)
        assert trashed is not None, "the row must stay so the account can be restored"
        assert trashed.deleted_at is not None
        assert trashed.is_active is False, "a trashed account must be locked out"

        async with fk_env() as session:
            leftover_sessions = (await session.execute(
                select(UserSession).where(UserSession.user_id == victim_id)
            )).scalars().all()
            assert leftover_sessions == [], "an open session must not survive the deletion"

            # The audit trail keeps pointing at the account while it is in the
            # trash — that is the whole reason the row is not erased right away.
            logs = (await session.execute(
                select(AuditLog).where(AuditLog.user_id == victim_id)
            )).scalars().all()
            assert logs, "the audit trail is what makes a restore trustworthy"


async def test_a_trashed_account_is_hidden_and_locked_out(fk_env):
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        async with fk_env() as session:
            victim_id = (
                await session.execute(select(User).where(User.email == VICTIM_EMAIL))
            ).scalar_one().id

        assert (await admin_client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

        listed = (await admin_client.get("/api/v1/users/")).json()
        assert [u["id"] for u in listed] == [
            await _user_id(fk_env, ADMIN_EMAIL)
        ], "a trashed account must not appear in the user list"

        # The token they were holding a moment ago is dead too: the account now
        # fails the is_active check in the auth dependency (403, not a 200).
        me = await victim_client.get("/api/v1/profile/me")
        assert me.status_code == 403, me.text
        assert "Inactive" in me.json()["detail"]

        # Signing in again is refused as well — the account is inactive, so the
        # login flow stops it before any token is minted.
        relogin = await victim_client.post("/api/v1/auth/login", json={
            "email": VICTIM_EMAIL, "password": PASSWORD})
        assert relogin.status_code == 403, relogin.text
        assert "access_token" not in relogin.text

        trash = (await admin_client.get("/api/v1/users/deleted")).json()
        assert [u["id"] for u in trash] == [victim_id]
        assert trash[0]["days_remaining"] == 30, "a fresh deletion has the full window"


async def test_restore_returns_the_account_to_service(fk_env):
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        async with fk_env() as session:
            victim_id = (
                await session.execute(select(User).where(User.email == VICTIM_EMAIL))
            ).scalar_one().id

        assert (await admin_client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

        restored = await admin_client.post(f"/api/v1/users/{victim_id}/restore")
        assert restored.status_code == 200, restored.text

        victim = await _trash(fk_env, victim_id)
        assert victim is not None and victim.deleted_at is None
        assert victim.is_active is True

        assert (await admin_client.get("/api/v1/users/deleted")).json() == []
        assert victim_id in [u["id"] for u in (await admin_client.get("/api/v1/users/")).json()]

        # And they can sign in again — the identity was never rewritten.
        assert (await victim_client.post("/api/v1/auth/login", json={
            "email": VICTIM_EMAIL, "password": PASSWORD})).status_code == 200


async def test_restoring_a_live_account_is_404(fk_env):
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        victim_id = await _user_id(fk_env, VICTIM_EMAIL)

        resp = await admin_client.post(f"/api/v1/users/{victim_id}/restore")
        assert resp.status_code == 404, resp.text


async def test_purge_erases_the_row_and_nulls_the_audit_trail(fk_env):
    """The one irreversible path: only reachable from the trash, and it hands
    ``audit_logs.user_id`` back to the database's ON DELETE SET NULL rule."""
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        victim_id = await _user_id(fk_env, VICTIM_EMAIL)

        assert (await admin_client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

        purged = await admin_client.delete(
            f"/api/v1/users/{victim_id}", params={"purge": "true"}
        )
        assert purged.status_code == 200, purged.text
        assert purged.json()["data"]["purged"] is True

        assert await _trash(fk_env, victim_id) is None, "purge must erase the row"

        async with fk_env() as session:
            logs = (await session.execute(
                select(AuditLog).where(AuditLog.user_id == victim_id)
            )).scalars().all()
            assert logs == [], "their rows are detached…"

            orphaned = (await session.execute(
                select(AuditLog).where(AuditLog.user_id.is_(None))
            )).scalars().all()
            assert orphaned, "…not deleted: the audit trail survives with user_id NULL"


async def test_purge_refuses_an_account_that_is_not_in_the_trash(fk_env):
    """A permanent delete has to be a deliberate second step."""
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        victim_id = await _user_id(fk_env, VICTIM_EMAIL)

        resp = await admin_client.delete(
            f"/api/v1/users/{victim_id}", params={"purge": "true"}
        )
        assert resp.status_code == 400, resp.text
        assert await _trash(fk_env, victim_id) is not None


async def test_expired_trash_is_purged_on_the_next_panel_load(fk_env):
    """There is no cron here, so the admin list does the housekeeping."""
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        victim_id = await _user_id(fk_env, VICTIM_EMAIL)
        assert (await admin_client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

        # Age the deletion past the retention window.
        async with fk_env() as session:
            victim = (
                await session.execute(select(User).where(User.id == victim_id))
            ).scalar_one()
            victim.deleted_at = utcnow() - timedelta(days=RETENTION_DAYS + 1)
            await session.commit()

        assert (await admin_client.get("/api/v1/users/")).status_code == 200

        assert await _trash(fk_env, victim_id) is None
        assert (await admin_client.get("/api/v1/users/deleted")).json() == []


async def test_soft_deleting_twice_is_404(fk_env):
    """The second attempt must not silently restart the retention window."""
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        victim_id = await _user_id(fk_env, VICTIM_EMAIL)
        assert (await admin_client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

        first = await _trash(fk_env, victim_id)
        again = await admin_client.delete(f"/api/v1/users/{victim_id}")

        assert again.status_code == 404, again.text
        assert (await _trash(fk_env, victim_id)).deleted_at == first.deleted_at


async def test_admin_cannot_delete_their_own_account(fk_env):
    async with await _client() as admin_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        admin_id = await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        resp = await admin_client.delete(f"/api/v1/users/{admin_id}")
        assert resp.status_code == 400, resp.text
        assert "ตัวเอง" in resp.json()["detail"]

        async with fk_env() as session:
            assert (await session.execute(
                select(User).where(User.id == admin_id)
            )).scalar_one_or_none() is not None


async def test_deleting_an_unknown_user_is_404(fk_env):
    async with await _client() as admin_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        resp = await admin_client.delete("/api/v1/users/987654")
        assert resp.status_code == 404, resp.text


async def test_non_admin_cannot_delete_users(fk_env):
    async with await _client() as user_client, await _client() as victim_client:
        await _register(user_client, "plain@example.com", "Plain")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _login(user_client, "plain@example.com")

        async with fk_env() as session:
            victim_id = (
                await session.execute(select(User).where(User.email == VICTIM_EMAIL))
            ).scalar_one().id

        resp = await user_client.delete(f"/api/v1/users/{victim_id}")
        assert resp.status_code == 403, resp.text


async def test_audit_page_still_renders_after_a_deletion(fk_env):
    """The admin audit log joins user rows; a deleted account must not break it."""
    async with await _client() as admin_client, await _client() as victim_client:
        await _register(admin_client, ADMIN_EMAIL, "Admin")
        await _register(victim_client, VICTIM_EMAIL, "Victim")
        await _promote_to_admin(fk_env, ADMIN_EMAIL)
        await _login(victim_client, VICTIM_EMAIL)
        await _login(admin_client, ADMIN_EMAIL)

        async with fk_env() as session:
            victim_id = (
                await session.execute(select(User).where(User.email == VICTIM_EMAIL))
            ).scalar_one().id

        assert (await admin_client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

        page = await admin_client.get("/api/v1/audit/paginated", params={
            "page": 1, "size": 20})
        assert page.status_code == 200, page.text
        assert page.json()["total"] >= 1
