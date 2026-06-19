"""
User Management Endpoints (Admin Only)
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.user import UserResponse, UserCreate, UserAdminUpdate, UserAdminCreate
from app.schemas.response import ResponseModel
from app.services.user_service import UserService
from app.api.dependencies import get_current_admin_user
from app.models.user import User

from app.services.audit_service import AuditService

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all users (Admin only)
    """
    user_service = UserService(db)
    users = await user_service.get_users(skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user by ID (Admin only)
    """
    user_service = UserService(db)
    user = await user_service.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.post("/", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new user with email and password (Admin only)
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        user = await user_service.create_user(user_create)

        await audit_service.log_action(
            action="ADMIN_USER_CREATE",
            user_id=current_user.id,
            details=f"Admin created user: {user.email} (ID: {user.id}) with role: {user.role}",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return ResponseModel(
            result="success",
            message="สร้างผู้ใช้สำเร็จ",
            data={"user_id": user.id, "email": user.email},
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/admin-create", response_model=ResponseModel, status_code=status.HTTP_201_CREATED
)
async def admin_create_user(
    user_create: UserAdminCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create general user with Username, Display Name, Password, and optional Email (Admin only)
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        user = await user_service.admin_create_user(user_create)

        await audit_service.log_action(
            action="ADMIN_USER_CREATE_HYBRID",
            user_id=current_user.id,
            details=f"Admin created user with Username: {user.username} (ID: {user.id})",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        return ResponseModel(
            result="success",
            message="สร้างผู้ใช้สำเร็จ",
            data={"user_id": user.id, "username": user.username, "email": user.email},
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{user_id}", response_model=ResponseModel)
async def update_user(
    user_id: int,
    user_update: UserAdminUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user settings (Admin only)
    """
    # Safeguard: Prevent self-targeting admin changes that would cause system lockout
    if current_user.id == user_id:
        if user_update.is_locked is True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="คุณไม่สามารถล็อคบัญชีของตัวเองได้เพื่อป้องกันระบบล็อคถาวร",
            )
        if user_update.role is not None and user_update.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="คุณไม่สามารถเปลี่ยนบทบาทของตัวเองออกจากสิทธิ์ผู้ดูแลระบบได้",
            )

    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        updated_user = await user_service.admin_update_user(user_id, user_update)

        await audit_service.log_action(
            action="ADMIN_USER_UPDATE",
            user_id=current_user.id,
            details=(
                f"Admin updated user {updated_user.email or updated_user.username} (ID: {user_id}). "
                f"Fields: {', '.join([k for k, v in user_update.dict(exclude_unset=True).items() if v is not None])}"
            ),
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        return ResponseModel(
            result="success",
            message="อัปเดตผู้ใช้สำเร็จ",
            data={"user_id": updated_user.id, "email": updated_user.email},
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{user_id}", response_model=ResponseModel)
async def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete user (Admin only)
    """
    # Safeguard: Prevent self-targeting admin deletion that would cause system lockout
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="คุณไม่สามารถลบบัญชีผู้ใช้ของตัวเองได้เพื่อป้องกันระบบล็อคถาวร",
        )

    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Get user email/username before deletion for logging
    target_user = await user_service.get_user_by_id(user_id)
    target_identifier = (
        target_user.email
        if (target_user and target_user.email)
        else (target_user.username if target_user else f"ID {user_id}")
    )

    success = await user_service.delete_user(user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await audit_service.log_action(
        action="ADMIN_USER_DELETE",
        user_id=current_user.id,
        details=f"Admin deleted user: {target_identifier} (ID: {user_id})",
        ip_address=client_ip,
        user_agent=user_agent,
    )
    await db.commit()

    return ResponseModel(
        result="success",
        message="ลบผู้ใช้สำเร็จ",
    )
