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


# ── Settings guard tests ─────────────────────────────────
# The legacy schema repair issues raw ALTER TABLE at startup, duplicating Alembic.
# Production must never run it, so AUTO_MIGRATE_COLUMNS_EFFECTIVE forces it off
# whenever DEBUG=False — even if the raw flag was explicitly set in the env.

class TestAutoMigrateColumnsGuard:
    @staticmethod
    def _settings(debug: str, flag: str):
        from app.core.config import Settings

        env = {"DEBUG": debug, "AUTO_MIGRATE_COLUMNS": flag}
        with patch.dict(os.environ, env):
            return Settings()

    def test_production_refuses_schema_repair(self):
        s = self._settings("false", "true")
        assert s.DEBUG is False
        assert s.AUTO_MIGRATE_COLUMNS is True  # raw flag is still set...
        assert s.AUTO_MIGRATE_COLUMNS_EFFECTIVE is False  # ...but is ignored

    def test_development_keeps_schema_repair(self):
        s = self._settings("true", "true")
        assert s.AUTO_MIGRATE_COLUMNS_EFFECTIVE is True

    def test_explicit_opt_out_is_honored_in_dev(self):
        s = self._settings("true", "false")
        assert s.AUTO_MIGRATE_COLUMNS_EFFECTIVE is False

    def test_production_without_flag_stays_off(self):
        s = self._settings("false", "false")
        assert s.AUTO_MIGRATE_COLUMNS_EFFECTIVE is False
