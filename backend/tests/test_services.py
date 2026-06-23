"""
Comprehensive test suite for ART Workspace backend services.
Uses in-memory SQLite (aiosqlite) for fast, isolated async testing.
"""
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.core.database import Base
from app.services.user_service import UserService
from app.services.auth_service import AuthService
from app.schemas.user import UserCreate, UserUpdate, UserPasswordChange

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
