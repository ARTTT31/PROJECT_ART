"""
User Service - Business logic for user management
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserAdminUpdate, UserAdminCreate
from app.core.security import get_password_hash, verify_password


def _utcnow() -> datetime:
    """Return current UTC time without tzinfo (for SQLAlchemy DateTime fields)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserService:
    """Service for user-related operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_user_by_email_or_username(self, username_or_email: str) -> Optional[User]:
        """Get user by email or username"""
        result = await self.db.execute(
            select(User).where(
                (User.email == username_or_email.lower()) |
                (User.username == username_or_email)
            )
        )
        return result.scalar_one_or_none()

    async def get_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Get list of users with pagination"""
        result = await self.db.execute(select(User).offset(skip).limit(limit))
        return result.scalars().all()

    async def create_user(self, user_create: UserCreate) -> User:
        """
        Create new user

        Args:
            user_create: User creation data

        Returns:
            Created user

        Raises:
            ValueError: If email already exists
        """
        # Check if email already exists
        existing_user = await self.get_user_by_email(user_create.email)
        if existing_user:
            raise ValueError("อีเมลนี้ถูกใช้งานแล้ว")

        # Create new user
        hashed_password = get_password_hash(user_create.password)

        db_user = User(
            email=user_create.email.lower(),
            hashed_password=hashed_password,
            name=user_create.name,
            role=user_create.role or "user",
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
            raise ValueError("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว")

        # Check if email already exists
        if user_create.email:
            existing_email = await self.get_user_by_email(user_create.email)
            if existing_email:
                raise ValueError("อีเมลนี้ถูกใช้งานแล้ว")

        hashed_password = get_password_hash(user_create.password)

        db_user = User(
            username=user_create.username,
            display_name=user_create.display_name,
            name=user_create.display_name,  # Set name to display_name as well for backward compatibility
            email=user_create.email.lower() if user_create.email else None,
            hashed_password=hashed_password,
            role=user_create.role or "user",
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

        user.updated_at = _utcnow()

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
        user.updated_at = _utcnow()

        await self.db.commit()

        return True

    async def update_avatar(self, user_id: int, avatar_base64: str) -> None:
        """Update user avatar"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        user.avatar = avatar_base64
        user.updated_at = _utcnow()

        await self.db.commit()

    async def update_quick_links(self, user_id: int, quick_links: str) -> None:
        """Update user quick links"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("ไม่พบผู้ใช้")

        user.quick_links = quick_links
        user.updated_at = _utcnow()

        await self.db.commit()

    async def delete_user(self, user_id: int) -> bool:
        """
        Delete user

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

    async def update_last_login(
        self, user_id: int, ip_address: Optional[str] = None, device: Optional[str] = None
    ) -> None:
        """Update user's last login timestamp and metadata"""
        user = await self.get_user_by_id(user_id)
        if user:
            user.last_login = _utcnow()
            if ip_address:
                user.last_login_ip = ip_address
            if device:
                user.last_login_device = device
            await self.db.commit()

    async def admin_update_user(self, user_id: int, user_update: UserAdminUpdate) -> User:
        """
        Update user information as admin
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
            user.display_name = user_update.name  # Sync display_name with name
        if user_update.role is not None:
            user.role = user_update.role
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
        if user_update.is_locked is not None:
            user.is_locked = user_update.is_locked
            if not user_update.is_locked:
                user.locked_until = None
                user.failed_login_attempts = 0
        if user_update.password is not None and user_update.password != "":
            user.hashed_password = get_password_hash(user_update.password)

        user.updated_at = _utcnow()
        await self.db.commit()
        await self.db.refresh(user)
        return user
