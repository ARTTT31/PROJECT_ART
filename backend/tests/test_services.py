"""
Comprehensive test suite for ART Workspace backend services.
Uses in-memory SQLite (aiosqlite) for fast, isolated async testing.
"""
import os

import pytest
from unittest.mock import patch
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.session import UserSession
from app.services.user_service import UserService
from app.services.auth_service import AuthService
from app.schemas.user import UserCreate, UserUpdate

# ── Fixtures ──────────────────────────────────────────────

@pytest.fixture
async def db_session():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    
    await engine.dispose()


@pytest.fixture
def user_service(db_session):
    return UserService(db_session)


@pytest.fixture
def auth_service(db_session):
    return AuthService(db_session)


@pytest.fixture
def sample_user_data():
    return UserCreate(
        email="test@example.com",
        password="SecretPass123",
        name="Test User",
    )


@pytest.fixture
def admin_user_data():
    return UserCreate(
        email="admin@example.com",
        password="AdminPass123",
        name="Admin User",
        role="admin",
    )


# ── UserService Tests ─────────────────────────────────────

class TestUserServiceCreate:
    pytestmark = pytest.mark.asyncio

    async def test_create_user_success(self, user_service, sample_user_data):
        user = await user_service.create_user(sample_user_data)
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.name == "Test User"
        assert user.role == "user"
        assert user.is_active is True

    async def test_create_user_duplicate_email_raises(self, user_service, sample_user_data):
        await user_service.create_user(sample_user_data)
        with pytest.raises(ValueError, match="อีเมลนี้ถูกใช้งานแล้ว"):
            await user_service.create_user(sample_user_data)

    async def test_create_user_email_lowercased(self, user_service):
        data = UserCreate(email="UPPER@Example.COM", password="SecretPass123", name="Upper")
        user = await user_service.create_user(data)
        assert user.email == "upper@example.com"

    async def test_create_user_with_admin_role(self, user_service, admin_user_data):
        user = await user_service.create_user(admin_user_data)
        assert user.role == "admin"


class TestUserServiceRead:
    pytestmark = pytest.mark.asyncio

    async def test_get_user_by_id(self, user_service, sample_user_data):
        created = await user_service.create_user(sample_user_data)
        found = await user_service.get_user_by_id(created.id)
        assert found is not None
        assert found.email == created.email

    async def test_get_user_by_id_not_found(self, user_service):
        assert await user_service.get_user_by_id(9999) is None

    async def test_get_user_by_email(self, user_service, sample_user_data):
        await user_service.create_user(sample_user_data)
        found = await user_service.get_user_by_email("test@example.com")
        assert found is not None
        assert found.name == "Test User"

    async def test_get_user_by_email_not_found(self, user_service):
        assert await user_service.get_user_by_email("nobody@example.com") is None

    async def test_get_users_returns_list(self, user_service):
        await user_service.create_user(UserCreate(email="a@b.com", password="Pass12345", name="A"))
        await user_service.create_user(UserCreate(email="c@d.com", password="Pass12345", name="C"))
        users = await user_service.get_users()
        assert len(users) == 2

    async def test_get_users_with_pagination(self, user_service):
        for i in range(5):
            await user_service.create_user(
                UserCreate(email=f"user{i}@test.com", password="Pass12345", name=f"User{i}")
            )
        page = await user_service.get_users(skip=2, limit=2)
        assert len(page) == 2


class TestUserServiceUpdate:
    pytestmark = pytest.mark.asyncio

    async def test_update_user_name(self, user_service, sample_user_data):
        created = await user_service.create_user(sample_user_data)
        updated = await user_service.update_user(created.id, UserUpdate(name="New Name"))
        assert updated.name == "New Name"

    async def test_update_user_email(self, user_service, sample_user_data):
        created = await user_service.create_user(sample_user_data)
        updated = await user_service.update_user(created.id, UserUpdate(email="new@example.com"))
        assert updated.email == "new@example.com"

    async def test_update_user_duplicate_email_raises(self, user_service):
        await user_service.create_user(UserCreate(email="a@b.com", password="Pass12345", name="A"))
        user2 = await user_service.create_user(UserCreate(email="c@d.com", password="Pass12345", name="C"))
        with pytest.raises(ValueError, match="อีเมลนี้ถูกใช้งานแล้ว"):
            await user_service.update_user(user2.id, UserUpdate(email="a@b.com"))

    async def test_update_nonexistent_user_raises(self, user_service):
        with pytest.raises(ValueError, match="ไม่พบผู้ใช้"):
            await user_service.update_user(9999, UserUpdate(name="Ghost"))


class TestUserServicePassword:
    pytestmark = pytest.mark.asyncio

    async def test_change_password_success(self, user_service, sample_user_data):
        created = await user_service.create_user(sample_user_data)
        result = await user_service.change_password(
            created.id, "SecretPass123", "NewPassword456"
        )
        assert result is True
        # Verify new password works
        from app.core.security import verify_password
        user = await user_service.get_user_by_id(created.id)
        assert verify_password("NewPassword456", user.hashed_password)

    async def test_change_password_wrong_old_password(self, user_service, sample_user_data):
        created = await user_service.create_user(sample_user_data)
        result = await user_service.change_password(created.id, "WrongPassword", "NewPass456")
        assert result is False


class TestUserServiceDelete:
    pytestmark = pytest.mark.asyncio

    async def test_delete_user_success(self, user_service, sample_user_data):
        created = await user_service.create_user(sample_user_data)
        result = await user_service.delete_user(created.id)
        assert result is True
        assert await user_service.get_user_by_id(created.id) is None

    async def test_delete_nonexistent_user_returns_false(self, user_service):
        result = await user_service.delete_user(9999)
        assert result is False


# ── AuthService Tests ─────────────────────────────────────

class TestAuthServiceLogin:
    pytestmark = pytest.mark.asyncio

    async def test_login_success(self, auth_service, user_service, sample_user_data):
        await user_service.create_user(sample_user_data)
        result = await auth_service.login(
            email="test@example.com",
            password="SecretPass123",
        )
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["user"]["email"] == "test@example.com"
        assert result["user"]["name"] == "Test User"

    async def test_login_wrong_password(self, auth_service, user_service, sample_user_data):
        await user_service.create_user(sample_user_data)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.login(email="test@example.com", password="WrongPass")
        assert exc_info.value.status_code == 401

    async def test_login_nonexistent_email(self, auth_service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.login(email="nobody@example.com", password="Whatever")
        assert exc_info.value.status_code == 401

    async def test_login_inactive_user_raises(self, auth_service, user_service, sample_user_data):
        user = await user_service.create_user(sample_user_data)
        user.is_active = False
        await user_service.db.commit()
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.login(email="test@example.com", password="SecretPass123")
        assert exc_info.value.status_code == 403


class TestAuthServiceRegister:
    pytestmark = pytest.mark.asyncio

    async def test_register_success(self, auth_service, user_service):
        user = await auth_service.register(UserCreate(
            email="new@example.com", password="NewPass123", name="New User"
        ))
        assert user.id is not None
        assert user.email == "new@example.com"

    async def test_register_duplicate_email_raises(self, auth_service, user_service, sample_user_data):
        await auth_service.register(sample_user_data)
        with pytest.raises(ValueError):
            await auth_service.register(sample_user_data)


class TestAuthServiceTokenRefresh:
    pytestmark = pytest.mark.asyncio

    async def test_refresh_token_success(self, auth_service, user_service, sample_user_data):
        await user_service.create_user(sample_user_data)
        result = await auth_service.login(email="test@example.com", password="SecretPass123")
        new_tokens = await auth_service.refresh_access_token(result["refresh_token"])
        assert new_tokens.access_token is not None
        assert new_tokens.refresh_token is not None

    async def test_refresh_token_invalid_raises(self, auth_service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            await auth_service.refresh_access_token("invalid.token.here")


class TestAuthServiceLogout:
    pytestmark = pytest.mark.asyncio

    async def test_logout_invalidates_session(self, auth_service, user_service, sample_user_data):
        await user_service.create_user(sample_user_data)
        result = await auth_service.login(
            email="test@example.com",
            password="SecretPass123",
            session_id="test-session-123",
        )
        await auth_service.logout("test-session-123")
        # After logout, session should be inactive
        from app.models.session import UserSession
        db_res = await user_service.db.execute(select(UserSession).filter(
            UserSession.session_id == "test-session-123"
        ))
        session = db_res.scalar_one_or_none()
        assert session is not None
        assert session.is_active is False


# ── Security Module Tests ─────────────────────────────────

class TestSecurity:
    def test_password_hash_and_verify(self):
        from app.core.security import get_password_hash, verify_password
        hashed = get_password_hash("MyPassword123")
        assert verify_password("MyPassword123", hashed) is True
        assert verify_password("WrongPassword", hashed) is False

    def test_create_and_decode_access_token(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token(data={"sub": "user@test.com", "user_id": 1})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user@test.com"
        assert payload["user_id"] == 1

    def test_decode_invalid_token_returns_none(self):
        from app.core.security import decode_token
        assert decode_token("invalid.jwt.token") is None

    def test_create_refresh_token_has_type(self):
        from app.core.security import create_refresh_token, decode_token
        token = create_refresh_token(data={"sub": "user@test.com", "user_id": 1})
        payload = decode_token(token)
        assert payload is not None
        assert payload.get("type") == "refresh"


# ── Session Cleanup Tests ─────────────────────────────────
# session_cleanup uses the SYNC SQLAlchemy API (it is meant to be runnable
# standalone via `python -m app.services.session_cleanup`), so these tests use a
# plain sync SQLite session rather than the async fixture above.


@pytest.fixture
def sync_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _make_user(session):
    from app.models.user import User

    user = User(
        username="sessionowner",
        name="Session Owner",
        email="session@example.com",
        hashed_password="x",
        role="user",
    )
    session.add(user)
    session.commit()
    return user


def _make_session(session, user, **kwargs):
    from app.models.session import UserSession
    from app.core.utils import utcnow

    tag = kwargs.pop("tag", "x")
    defaults = {
        "session_id": f"sid-{user.id}-{tag}",
        "user_id": user.id,
        "is_active": True,
        "last_activity": utcnow(),
        "expires_at": utcnow() + timedelta(days=7),
    }
    defaults.update(kwargs)
    row = UserSession(**defaults)
    session.add(row)
    session.commit()
    return row


class TestSessionCleanup:
    def test_removes_expired_sessions(self, sync_session):
        from app.services.session_cleanup import cleanup_expired_sessions
        from app.core.utils import utcnow

        user = _make_user(sync_session)
        _make_session(sync_session, user, tag="expired", expires_at=utcnow() - timedelta(days=1))
        _make_session(sync_session, user, tag="live", expires_at=utcnow() + timedelta(days=7))

        removed = cleanup_expired_sessions(sync_session)
        assert removed == 1
        remaining = sync_session.query(UserSession).all()
        assert [r.session_id for r in remaining] == ["sid-1-live"]

    def test_removes_stale_inactive_sessions(self, sync_session):
        from app.services.session_cleanup import cleanup_expired_sessions
        from app.core.utils import utcnow

        user = _make_user(sync_session)
        old = utcnow() - timedelta(days=30)
        _make_session(sync_session, user, tag="stale", is_active=False,
                      expires_at=utcnow() + timedelta(days=7))
        # Backdate updated_at so it also falls outside the 7-day window.
        stale_row = sync_session.query(UserSession).filter_by(
            session_id="sid-1-stale"
        ).one()
        stale_row.updated_at = old
        sync_session.commit()

        removed = cleanup_expired_sessions(sync_session, max_age_days=7)
        assert removed == 1
        assert sync_session.query(UserSession).count() == 0

    def test_keeps_recent_inactive_session(self, sync_session):
        from app.services.session_cleanup import cleanup_expired_sessions
        from app.core.utils import utcnow

        user = _make_user(sync_session)
        _make_session(sync_session, user, tag="recent", is_active=False,
                      expires_at=utcnow() + timedelta(days=7))

        removed = cleanup_expired_sessions(sync_session, max_age_days=7)
        assert removed == 0
        assert sync_session.query(UserSession).count() == 1

    def test_no_sessions_is_noop(self, sync_session):
        from app.services.session_cleanup import cleanup_expired_sessions

        assert cleanup_expired_sessions(sync_session) == 0

    def test_run_cleanup_without_database_url_exits(self, monkeypatch):
        from app.services import session_cleanup

        monkeypatch.delenv("DATABASE_URL", raising=False)
        with pytest.raises(SystemExit) as exc:
            session_cleanup.run_cleanup()
        assert exc.value.code == 1

    def test_run_cleanup_uses_database_url(self, monkeypatch, tmp_path):
        from app.services import session_cleanup

        db_path = tmp_path / "cleanup.sqlite"
        db_url = f"sqlite:///{db_path}"
        monkeypatch.setenv("DATABASE_URL", db_url)

        # Create the schema once so the cleanup job has a real table to query.
        engine = create_engine(db_url)
        Base.metadata.create_all(engine)
        engine.dispose()

        session_cleanup.run_cleanup()  # must not raise

    def test_the_docstring_no_longer_points_at_docker(self):
        """Docker was removed from the project; the usage block still said `docker exec`."""
        from app.services import session_cleanup

        doc = (session_cleanup.__doc__ or "").lower()
        assert "docker exec" not in doc
        assert "docker-compose" not in doc


# ── Scheduled session cleanup ─────────────────────────────
# The cleanup job used to be a script nobody called. It now also runs on an
# interval inside the app, so the async twin and the loop behaviour are covered
# here as well as the sync script above.

class TestSessionCleanupScheduler:
    @staticmethod
    async def _user(db_session):
        from app.models.user import User

        user = User(
            username="scheduler-user",
            name="Scheduler User",
            email="scheduler@example.com",
            hashed_password="x",
            role="user",
        )
        db_session.add(user)
        await db_session.commit()
        assert user.id is not None
        return user

    async def test_removes_expired_rows(self, db_session):
        from app.core.utils import utcnow
        from app.services.session_cleanup import cleanup_expired_sessions_async

        user = await self._user(db_session)
        db_session.add_all([
            UserSession(
                session_id="sid-expired",
                user_id=user.id,
                is_active=True,
                last_activity=utcnow(),
                expires_at=utcnow() - timedelta(days=1),
            ),
            UserSession(
                session_id="sid-live",
                user_id=user.id,
                is_active=True,
                last_activity=utcnow(),
                expires_at=utcnow() + timedelta(days=7),
            ),
        ])
        await db_session.commit()

        removed = await cleanup_expired_sessions_async(db_session)

        assert removed == 1
        remaining = (await db_session.execute(select(UserSession))).scalars().all()
        assert [row.session_id for row in remaining] == ["sid-live"]

    async def test_keeps_a_recent_inactive_row(self, db_session):
        from app.core.utils import utcnow
        from app.services.session_cleanup import cleanup_expired_sessions_async

        user = await self._user(db_session)
        db_session.add(
            UserSession(
                session_id="sid-recent",
                user_id=user.id,
                is_active=False,
                last_activity=utcnow(),
                expires_at=utcnow() + timedelta(days=7),
            )
        )
        await db_session.commit()

        assert await cleanup_expired_sessions_async(db_session) == 0

    async def test_the_scheduled_loop_keeps_going_after_a_failed_pass(self, monkeypatch):
        """A transient database error must not kill the scheduler task."""
        import asyncio

        from app import main as main_module

        calls = {"count": 0}

        async def fake_cleanup(db):
            calls["count"] += 1
            if calls["count"] == 1:
                raise RuntimeError("database unavailable")

        class _FakeSession:
            async def __aenter__(self):
                return object()

            async def __aexit__(self, *exc):
                return False

        sleeps = {"count": 0}

        async def fake_sleep(seconds):
            sleeps["count"] += 1
            if sleeps["count"] >= 3:
                raise asyncio.CancelledError

        monkeypatch.setattr(main_module, "SessionLocal", lambda: _FakeSession())
        monkeypatch.setattr(main_module, "cleanup_expired_sessions_async", fake_cleanup)
        monkeypatch.setattr(main_module.asyncio, "sleep", fake_sleep)

        with pytest.raises(asyncio.CancelledError):
            await main_module._session_cleanup_loop(6)

        assert calls["count"] == 2, "the second pass must still run"


# ── UserService admin / edge-path tests ───────────────────
# These cover the branches that the API tests do not reach: duplicate-email
# guards, admin role/page updates, lockout reset, and delete/password paths.

class TestUserServiceAdminPaths:
    async def test_update_user_rejects_duplicate_email(self, user_service):
        from app.schemas.user import UserCreate, UserUpdate

        await user_service.create_user(UserCreate(
            email="taken@example.com", password="Pass1234", name="Taken"))
        target = await user_service.create_user(UserCreate(
            email="mover@example.com", password="Pass1234", name="Mover"))

        with pytest.raises(ValueError):
            await user_service.update_user(target.id, UserUpdate(email="taken@example.com"))

        # The rejected change must not have been persisted.
        assert (await user_service.get_user_by_id(target.id)).email == "mover@example.com"

    async def test_update_user_updates_fields(self, user_service, db_session):
        from app.schemas.user import UserUpdate

        user = await user_service.create_user(UserCreate(
            email="edit@example.com", password="Pass1234", name="Before"))
        updated = await user_service.update_user(user.id, UserUpdate(
            name="After",
            avatar="data:image/png;base64,AAA",
            quick_links='[{"id":"gmail","label":"Mail"}]',
            dashboard_layout='[{"id":"weather","w":2}]',
            camera_config='[{"id":"cam-1"}]',
        ))
        assert updated.name == "After"
        assert updated.avatar.startswith("data:image/png")
        assert updated.dashboard_layout == '[{"id":"weather","w":2}]'
        assert updated.camera_config == '[{"id":"cam-1"}]'

    async def test_update_user_missing_raises(self, user_service):
        from app.schemas.user import UserUpdate

        with pytest.raises(ValueError):
            await user_service.update_user(99999, UserUpdate(name="Ghost"))

    async def test_admin_create_user_rejects_duplicate_username(self, user_service):
        from app.schemas.user import UserAdminCreate

        await user_service.admin_create_user(UserAdminCreate(
            username="admin1", display_name="Admin One", password="Pass1234"))
        with pytest.raises(ValueError):
            await user_service.admin_create_user(UserAdminCreate(
                username="admin1", display_name="Admin One Again", password="Pass1234"))

    async def test_admin_create_user_rejects_duplicate_email(self, user_service):
        from app.schemas.user import UserAdminCreate

        await user_service.admin_create_user(UserAdminCreate(
            username="dupemail", display_name="Dup Email",
            password="Pass1234", email="dup@example.com"))
        with pytest.raises(ValueError):
            await user_service.admin_create_user(UserAdminCreate(
                username="other", display_name="Other",
                password="Pass1234", email="dup@example.com"))

    async def test_admin_update_user_sets_role_and_pages(self, user_service):
        from app.schemas.user import UserAdminUpdate

        user = await user_service.create_user(UserCreate(
            email="promote@example.com", password="Pass1234", name="Promote Me"))
        updated = await user_service.admin_update_user(user.id, UserAdminUpdate(
            role="admin", accessible_pages='["dashboard"]', is_active=True,
        ))
        assert updated.role == "admin"
        assert updated.accessible_pages == '["dashboard"]'
        assert updated.is_active is True

    async def test_admin_update_user_unlock_resets_attempts(self, user_service, db_session):
        from app.schemas.user import UserAdminUpdate

        user = await user_service.create_user(UserCreate(
            email="locked@example.com", password="Pass1234", name="Locked"))
        locked = await user_service.admin_update_user(user.id, UserAdminUpdate(
            is_locked=True))
        assert locked.is_locked is True

        unlocked = await user_service.admin_update_user(user.id, UserAdminUpdate(
            is_locked=False))
        assert unlocked.is_locked is False
        assert unlocked.locked_until is None
        assert unlocked.failed_login_attempts == 0

    async def test_admin_update_user_rejects_duplicate_email(self, user_service, db_session):
        from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserCreate

        await user_service.admin_create_user(UserAdminCreate(
            username="admin2", display_name="Admin Two",
            password="Pass1234", email="admin2@example.com"))
        target = await user_service.create_user(UserCreate(
            email="plain@example.com", password="Pass1234", name="Plain"))

        with pytest.raises(ValueError):
            await user_service.admin_update_user(
                target.id, UserAdminUpdate(email="admin2@example.com"))

    async def test_admin_update_user_sets_password(self, user_service):
        from app.schemas.user import UserAdminUpdate
        from app.core.security import verify_password

        user = await user_service.create_user(UserCreate(
            email="pwreset@example.com", password="OldPass123", name="Reset"))
        updated = await user_service.admin_update_user(
            user.id, UserAdminUpdate(password="NewPass123"))
        assert verify_password("NewPass123", updated.hashed_password) is True

    async def test_admin_update_user_missing_raises(self, user_service):
        from app.schemas.user import UserAdminUpdate

        with pytest.raises(ValueError):
            await user_service.admin_update_user(99999, UserAdminUpdate(name="Ghost"))

    async def test_change_password_flow(self, user_service):
        from app.core.security import verify_password

        user = await user_service.create_user(UserCreate(
            email="chpw@example.com", password="OldPass123", name="ChPw"))

        assert await user_service.change_password(user.id, "WrongPass", "NewPass123") is False
        assert await user_service.change_password(user.id, "OldPass123", "NewPass123") is True

        refreshed = await user_service.get_user_by_id(user.id)
        assert verify_password("NewPass123", refreshed.hashed_password) is True

    async def test_change_password_missing_user_raises(self, user_service):
        with pytest.raises(ValueError):
            await user_service.change_password(99999, "a", "b")

    async def test_delete_user(self, user_service):
        user = await user_service.create_user(UserCreate(
            email="bye@example.com", password="Pass1234", name="Bye"))
        assert await user_service.delete_user(user.id) is True
        assert await user_service.delete_user(user.id) is False

    async def test_update_last_login_records_metadata(self, user_service):
        user = await user_service.create_user(UserCreate(
            email="login@example.com", password="Pass1234", name="Login"))
        await user_service.update_last_login(user.id, ip_address="10.0.0.1", device="Chrome")

        refreshed = await user_service.get_user_by_id(user.id)
        assert refreshed.last_login_ip == "10.0.0.1"
        assert refreshed.last_login_device == "Chrome"
        assert refreshed.last_login is not None

    async def test_update_last_login_ignores_missing_user(self, user_service):
        await user_service.update_last_login(99999, ip_address="10.0.0.9")


# ── Cookie configuration guard tests ─────────────────────
# `SameSite=None` is only honoured together with `Secure`; over plain HTTP the
# browser drops the cookie and login silently fails to persist. The effective
# value must therefore never be `none` on a non-secure (local HTTP) setup.


class TestCookieSameSiteGuard:
    """`COOKIE_SECURE` / `COOKIE_SAMESITE` are resolved from `os.environ` at access
    time (so a deployed RENDER flag always wins), therefore the environment patch
    has to stay active while the assertions run — not just while Settings is built.
    """

    def test_none_is_downgraded_when_cookie_is_not_secure(self):
        from app.core.config import Settings

        env = {"DEBUG": "true", "COOKIE_SECURE": "false", "COOKIE_SAMESITE": "none"}
        with patch.dict(os.environ, env):
            s = Settings()
            assert s.COOKIE_SECURE is False
            assert s.COOKIE_SAMESITE == "none"           # raw value is kept
            assert s.COOKIE_SAMESITE_EFFECTIVE == "lax"  # ...but never sent to the browser

    def test_none_is_honoured_when_cookie_is_secure(self):
        from app.core.config import Settings

        env = {"DEBUG": "false", "COOKIE_SECURE": "true", "COOKIE_SAMESITE": "none"}
        with patch.dict(os.environ, env):
            assert Settings().COOKIE_SAMESITE_EFFECTIVE == "none"

    def test_lax_passes_through_unchanged(self):
        from app.core.config import Settings

        env = {"DEBUG": "true", "COOKIE_SECURE": "false", "COOKIE_SAMESITE": "lax"}
        with patch.dict(os.environ, env):
            s = Settings()
            assert s.COOKIE_SECURE is False
            assert s.COOKIE_SAMESITE_EFFECTIVE == "lax"
