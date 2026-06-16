"""
Authentication Service - Business logic for authentication
"""
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone
import uuid

from app.models.user import User
from app.models.session import UserSession
from app.schemas.user import UserCreate
from app.schemas.token import Token
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.services.user_service import UserService


class AuthService:
    """Service for authentication operations"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)

    async def login(
        self,
        email: str,
        password: str,
        session_id: Optional[str] = None,
        user_agent: Optional[str] = None,
        device_label: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Dict:
        """
        Authenticate user and create session
        
        Args:
            email: User email or username
            password: User password
            session_id: Optional session ID from client
            user_agent: User agent string
            device_label: Device label
            ip_address: Client IP address
        
        Returns:
            Dict with tokens and user info
        
        Raises:
            HTTPException: If authentication fails
        """
        # Get user (by email or username)
        user = await self.user_service.get_user_by_email_or_username(email)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง",
            )
        
        # Check if account is locked
        if user.is_locked:
            if user.locked_until and user.locked_until > datetime.now(timezone.utc).replace(tzinfo=None):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="บัญชีถูกล็อก กรุณาลองใหม่ภายหลัง",
                )
            else:
                # Unlock account if lock period has passed
                user.is_locked = False
                user.locked_until = None
                user.failed_login_attempts = 0
        
        # Check if account is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="บัญชีถูกปิดการใช้งาน",
            )
        
        # Verify password
        if not verify_password(password, user.hashed_password):
            # Increment failed login attempts
            user.failed_login_attempts += 1
            
            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.is_locked = True
                user.locked_until = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30)
                await self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="บัญชีถูกล็อกเนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง",
                )
            
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง",
            )
        
        # Reset failed login attempts
        user.failed_login_attempts = 0
        
        # Update last login
        await self.user_service.update_last_login(
            user.id, ip_address=ip_address, device=device_label
        )
        
        # Create or update session
        if not session_id:
            session_id = str(uuid.uuid4())
        
        existing_session = (
            await self.db.execute(select(UserSession).where(UserSession.session_id == session_id))
        ).scalar_one_or_none()
        
        if existing_session:
            existing_session.is_active = True
            existing_session.last_activity = datetime.now(timezone.utc).replace(tzinfo=None)
            existing_session.user_agent = user_agent
            existing_session.device_label = device_label
            existing_session.ip_address = ip_address
        else:
            new_session = UserSession(
                session_id=session_id,
                user_id=user.id,
                user_agent=user_agent,
                device_label=device_label,
                ip_address=ip_address,
                expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
            )
            self.db.add(new_session)
        
        await self.db.commit()
        
        # Create tokens (fallback to username if email is null)
        access_token = create_access_token(data={"sub": user.email or user.username, "user_id": user.id})
        refresh_token = create_refresh_token(data={"sub": user.email or user.username, "user_id": user.id})
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "session_id": session_id,
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "display_name": user.display_name,
                "name": user.name,
                "role": user.role,
                "avatar": user.avatar,
                "quick_links": user.quick_links,
            },
        }

    async def register(self, user_create: UserCreate) -> User:
        """
        Register new user
        
        Args:
            user_create: User creation data
        
        Returns:
            Created user
        """
        return await self.user_service.create_user(user_create)

    async def refresh_access_token(self, refresh_token: str) -> Token:
        """
        Create new access token from refresh token
        
        Args:
            refresh_token: Refresh token
        
        Returns:
            New token pair
        
        Raises:
            HTTPException: If refresh token is invalid
        """
        payload = decode_token(refresh_token)
        
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        
        sub = payload.get("sub")
        user_id = payload.get("user_id")
        
        if not sub or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        
        # Create new tokens
        access_token = create_access_token(data={"sub": sub, "user_id": user_id})
        new_refresh_token = create_refresh_token(data={"sub": sub, "user_id": user_id})
        
        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
        )

    async def logout(self, session_id: str) -> None:
        """
        Logout user and invalidate session
        
        Args:
            session_id: Session ID to invalidate
        """
        session = (
            await self.db.execute(select(UserSession).where(UserSession.session_id == session_id))
        ).scalar_one_or_none()
        
        if session:
            session.is_active = False
            await self.db.commit()
