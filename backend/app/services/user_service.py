"""
User Service - Business logic for user management
"""

from datetime import datetime, timedelta
from typing import List, Optional, Union
from sqlalchemy import func, or_
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import defer
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.models.session import UserSession
from app.models.user import User
from app.schemas.user import UserCreate, UserRegister, UserUpdate, UserAdminUpdate, UserAdminCreate
from app.core.security import get_password_hash, verify_password
from app.core.utils import utcnow


# Columns excluded from the per-request authentication lookup. They are the
# large ones (a base64 avatar plus three 100KB JSON blobs) and are only needed by
# the handful of endpoints that actually serve them.
AUTH_DEFERRED_COLUMNS = ("avatar", "quick_links", "dashboard_layout", "camera_config")


def _defer_profile_columns() -> list:
    """Loader options that leave the large profile columns out of the SELECT."""
    return [defer(getattr(User, name)) for name in AUTH_DEFERRED_COLUMNS]


def retention_days() -> int:
    """How long a deleted account can be restored before it is purged."""
    return max(0, settings.USER_DELETE_RETENTION_DAYS)


def purge_at(deleted_at: datetime) -> datetime:
    """When a given deletion date expires."""
    return deleted_at + timedelta(days=retention_days())


def _taken_message(base: str, existing: User) -> str:
    """Explain a taken email/username, including one that is only in the trash.

    A trashed account still owns its email and username (that is what makes a
    restore return the same identity), so the admin would otherwise see a
    plain "already in use" for a user they cannot even find in the list.
    """
    if existing.deleted_at is not None:
        return f"{base} (บัญชีอยู่ในถังขยะ — กู้คืนได้ในหน้า Admin Panel หรือรอให้ระบบลบถาวร)"
    return base


def _like_pattern(term: str) -> str:
    """Case-folded ``LIKE`` pattern for an admin search box.

    ``%`` and ``_`` are escaped so a term like ``a_b`` is a literal, not a
    wildcard, and the leading backslash is escaped first for the same reason.
    """
    escaped = (
        term.strip()
        .lower()
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    return f"%{escaped}%"


class UserService:
    """Service for user-related operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID (full row, including the large profile columns)"""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_for_auth(self, user_id: int) -> Optional[User]:
        """Get the columns authentication needs, without the large profile ones.

        ``resolve_user_from_token`` runs on every authenticated request but only
        reads ``is_active`` / ``is_locked`` / ``role``. Dragging the avatar and
        the 100KB JSON blobs along cost megabytes per request, so they are
        deferred here and re-selected explicitly by the endpoints that serve
        them (see ``app.api.dependencies.load_profile_columns``).
        """
        result = await self.db.execute(
            select(User).options(*_defer_profile_columns()).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_for_auth_by_email(self, email: str) -> Optional[User]:
        """Email-keyed counterpart of :meth:`get_user_for_auth`."""
        result = await self.db.execute(
            select(User)
            .options(*_defer_profile_columns())
            .where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_user_by_email_or_username(
        self, username_or_email: str
    ) -> Optional[User]:
        """Get user by email or username"""
        result = await self.db.execute(
            select(User).where(
                (User.email == username_or_email.lower())
                | (User.username == username_or_email)
            )
        )
        return result.scalar_one_or_none()

    def _user_filters(
        self,
        q: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        only_deleted: bool = False,
    ) -> list:
        """WHERE clauses shared by the admin list and its total count.

        Accounts in the trash are excluded by default — every listing has to
        agree on that, otherwise the paging numbers disagree with the rows.
        """
        conditions: List[ColumnElement[bool]] = (
            [User.deleted_at.is_not(None)] if only_deleted else [User.deleted_at.is_(None)]
        )

        if q and q.strip():
            pattern = _like_pattern(q)
            conditions.append(
                or_(
                    func.lower(User.email).like(pattern, escape="\\"),
                    func.lower(User.username).like(pattern, escape="\\"),
                    func.lower(User.name).like(pattern, escape="\\"),
                    func.lower(User.display_name).like(pattern, escape="\\"),
                )
            )

        if role:
            conditions.append(User.role == role)

        if is_active is not None:
            conditions.append(User.is_active == is_active)

        return conditions

    async def get_users(
        self,
        skip: int = 0,
        limit: int = 100,
        q: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        only_deleted: bool = False,
    ) -> List[User]:
        """Get list of users with search, filters and pagination."""
        result = await self.db.execute(
            select(User)
            .where(*self._user_filters(q=q, role=role, is_active=is_active, only_deleted=only_deleted))
            .order_by(User.id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_users(
        self,
        q: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        only_deleted: bool = False,
    ) -> int:
        """Total rows matching the same filters as :meth:`get_users`."""
        result = await self.db.execute(
            select(func.count(User.id)).where(
                *self._user_filters(q=q, role=role, is_active=is_active, only_deleted=only_deleted)
            )
        )
        return int(result.scalar() or 0)

    async def create_user(
        self, user_create: Union[UserCreate, UserRegister], role: str = "user"
    ) -> User:
        """
        Create new user

        Args:
            user_create: User creation data
            role: Role assigned by the SERVER — callers must not be able to
                choose it from unauthenticated endpoints (defaults to "user")

        Returns:
            Created user

        Raises:
            ValueError: If email already exists
        """
        # Check if email already exists
        existing_user = await self.get_user_by_email(user_create.email)
        if existing_user:
            raise ValueError(_taken_message("อีเมลนี้ถูกใช้งานแล้ว", existing_user))

        # Create new user
        hashed_password = get_password_hash(user_create.password)

        db_user = User(
            email=user_create.email.lower(),
            hashed_password=hashed_password,
            name=user_create.name,
            role=role,
        )

        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)

        return db_user

    async def admin_create_user(self, user_create: UserAdminCreate) -> User:
        """
        Create new user by administrator
        """
        # Check if username already exists
        existing_username = await self.get_user_by_username(user_create.username)
        if existing_username:
            raise ValueError(_taken_message("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว", existing_username))

        # Check if email already exists
        if user_create.email:
            existing_email = await self.get_user_by_email(user_create.email)
            if existing_email:
                raise ValueError(_taken_message("อีเมลนี้ถูกใช้งานแล้ว", existing_email))

        hashed_password = get_password_hash(user_create.password)

        db_user = User(
            username=user_create.username,
            display_name=user_create.display_name,
            name=user_create.display_name,  # Set name to display_name as well for backward compatibility
            email=user_create.email.lower() if user_create.email else None,
            hashed_password=hashed_password,
            role=user_create.role or "user",
            accessible_pages=user_create.accessible_pages,
        )

        try:
            self.db.add(db_user)
            await self.db.commit()
            await self.db.refresh(db_user)
        except IntegrityError:
            await self.db.rollback()
            raise ValueError("ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว")

        return db_user

    async def update_user(self, user_id: int, user_update: UserUpdate) -> User:
        """
        Update user profile

        Args:
            user_id: User ID to update
            user_update: Update data

        Returns:
            Updated user

        Raises:
            ValueError: If user not found or email already exists
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        # Check if new email already exists
        if user_update.email and user_update.email != user.email:
            existing_user = await self.get_user_by_email(user_update.email)
            if existing_user:
                raise ValueError("อีเมลนี้ถูกใช้งานแล้ว")
            user.email = user_update.email.lower()

        # Update fields
        if user_update.name is not None:
            user.name = user_update.name
        if user_update.avatar is not None:
            user.avatar = user_update.avatar
        if user_update.quick_links is not None:
            user.quick_links = user_update.quick_links
        if user_update.dashboard_layout is not None:
            user.dashboard_layout = user_update.dashboard_layout
        if user_update.camera_config is not None:
            user.camera_config = user_update.camera_config

        user.updated_at = utcnow()

        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def change_password(
        self, user_id: int, old_password: str, new_password: str
    ) -> bool:
        """
        Change user password

        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password

        Returns:
            True if successful, False if old password is incorrect
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        # Verify old password
        if not verify_password(old_password, user.hashed_password):
            return False

        # Update password
        user.hashed_password = get_password_hash(new_password)
        user.updated_at = utcnow()

        await self.db.commit()

        return True

    async def update_avatar(self, user_id: int, avatar_base64: str) -> None:
        """Update user avatar"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        user.avatar = avatar_base64
        user.updated_at = utcnow()

        await self.db.commit()

    async def update_quick_links(self, user_id: int, quick_links: str) -> None:
        """Update user quick links"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        user.quick_links = quick_links
        user.updated_at = utcnow()

        await self.db.commit()

    async def update_dashboard_layout(self, user_id: int, dashboard_layout: str) -> None:
        """Update user dashboard layout"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        user.dashboard_layout = dashboard_layout
        user.updated_at = utcnow()

        await self.db.commit()

    async def update_camera_config(self, user_id: int, camera_config: str) -> None:
        """Update user camera configuration"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        user.camera_config = camera_config
        user.updated_at = utcnow()

        await self.db.commit()

    async def delete_user(self, user_id: int) -> bool:
        """
        Delete user permanently

        Args:
            user_id: User ID to delete

        Returns:
            True if deleted, False if not found
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            return False

        await self.db.delete(user)
        await self.db.commit()

        return True

    async def revoke_sessions(self, user_id: int) -> int:
        """Drop every session row of a user, ending their sign-ins immediately."""
        sessions = (
            await self.db.execute(
                select(UserSession).where(UserSession.user_id == user_id)
            )
        ).scalars().all()

        for session in sessions:
            await self.db.delete(session)

        return len(sessions)

    async def soft_delete_user(self, user_id: int) -> Optional[User]:
        """Move a user to the trash.

        The account is hidden from every listing, locked out and its sessions
        are revoked, but the row survives so the admin can restore it inside
        the retention window and so ``audit_logs.user_id`` stays resolvable.

        Returns the updated user, or ``None`` when there is no live account
        with that ID (already deleted counts as absent).
        """
        user = await self.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            return None

        now = utcnow()
        user.deleted_at = now
        # Being in the trash has to mean being locked out: ``is_active`` is what
        # the login flow and every authenticated request check, and a token
        # issued before the deletion must stop working.
        user.is_active = False
        user.updated_at = now
        await self.revoke_sessions(user_id)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def restore_user(self, user_id: int) -> Optional[User]:
        """Bring a trashed account back.

        Returns the restored user, or ``None`` when it is not in the trash.
        """
        user = await self.get_user_by_id(user_id)
        if not user or user.deleted_at is None:
            return None

        user.deleted_at = None
        user.is_active = True
        user.updated_at = utcnow()
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_deleted_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """List trashed accounts, most recently deleted first."""
        result = await self.db.execute(
            select(User)
            .where(User.deleted_at.is_not(None))
            .order_by(User.deleted_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def purge_expired_users(self, retention: Optional[int] = None) -> int:
        """Permanently remove trashed accounts whose window has elapsed.

        Called from the admin endpoints (there is no cron in this deployment),
        so a trashed account leaves the database the next time an admin opens
        the panel. Returns how many rows were purged.
        """
        days = retention_days() if retention is None else max(0, retention)
        cutoff = utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(User).where(User.deleted_at.is_not(None), User.deleted_at <= cutoff)
        )
        expired = list(result.scalars().all())
        if not expired:
            return 0

        for user in expired:
            # ORM delete so the sessions relationship cascades: the sessions FK
            # has no ON DELETE rule, so a raw DELETE would violate it.
            await self.db.delete(user)
        await self.db.commit()
        return len(expired)

    async def update_last_login(
        self,
        user_id: int,
        ip_address: Optional[str] = None,
        device: Optional[str] = None,
    ) -> None:
        """Update user's last login timestamp and metadata"""
        user = await self.get_user_by_id(user_id)
        if user:
            user.last_login = utcnow()
            if ip_address:
                user.last_login_ip = ip_address
            if device:
                user.last_login_device = device
            await self.db.commit()

    async def admin_update_user(
        self, user_id: int, user_update: UserAdminUpdate
    ) -> User:
        """
        Update user information as admin
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")
        if user.deleted_at is not None:
            raise ValueError("บัญชีนี้อยู่ในถังขยะ — กู้คืนก่อนแก้ไขข้อมูล")

        # Check if new email already exists
        if user_update.email and user_update.email != user.email:
            existing_user = await self.get_user_by_email(user_update.email)
            if existing_user:
                raise ValueError(_taken_message("อีเมลนี้ถูกใช้งานแล้ว", existing_user))
            user.email = user_update.email.lower()

        # Update fields
        if user_update.name is not None:
            user.name = user_update.name
            user.display_name = user_update.name  # Sync display_name with name
        if user_update.role is not None:
            user.role = user_update.role
        if user_update.accessible_pages is not None:
            user.accessible_pages = user_update.accessible_pages
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
        if user_update.is_locked is not None:
            user.is_locked = user_update.is_locked
            if not user_update.is_locked:
                user.locked_until = None
                user.failed_login_attempts = 0
        if user_update.password is not None and user_update.password != "":
            user.hashed_password = get_password_hash(user_update.password)

        should_revoke = (
            user_update.is_active is False
            or user_update.is_locked is True
            or (user_update.password is not None and user_update.password != "")
        )
        if should_revoke:
            await self.revoke_sessions(user_id)

        user.updated_at = utcnow()
        await self.db.commit()
        await self.db.refresh(user)
        return user
