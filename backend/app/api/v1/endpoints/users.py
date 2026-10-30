"""
User Management Endpoints (Admin Only)
"""

import math
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.utils import utcnow
from app.schemas.user import (
    UserResponse,
    UserCreate,
    UserAdminUpdate,
    UserAdminCreate,
    UserTrashResponse,
)
from app.schemas.response import ResponseModel
from app.services.user_service import UserService, purge_at, retention_days
from app.api.dependencies import get_current_admin_user
from app.models.user import User

from app.services import email_service
from app.services.audit_service import AuditService

router = APIRouter()

# SlowAPI "limit" strings are static decorator values, so they are built once at
# import. All admin endpoints are user-paced (a page load, a click), so the
# general limit is comfortably above real usage while still bounding abuse.
_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"


@router.get("", response_model=List[UserResponse])
@router.get("/", response_model=List[UserResponse], include_in_schema=False)
@limiter.limit(_GENERAL_LIMIT)
async def list_users(
    request: Request,
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    q: Optional[str] = Query(None, max_length=100, description="ค้นหาจากชื่อ/อีเมล/ชื่อผู้ใช้"),
    role: Optional[Literal["user", "admin"]] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all users (Admin only)

    Case-insensitive search plus role/status filters and pagination. The number
    of matches is returned in ``X-Total-Count`` so the panel can page without a
    second round trip. Accounts in the trash are never listed here.
    """
    user_service = UserService(db)

    # Housekeeping. This panel load is the closest thing to a cron in this
    # deployment, so expired trash rows are purged on the way in.
    await user_service.purge_expired_users()

    users = await user_service.get_users(
        skip=skip, limit=limit, q=q, role=role, is_active=is_active
    )
    total = await user_service.count_users(q=q, role=role, is_active=is_active)
    response.headers["X-Total-Count"] = str(total)
    return users


@router.get("/deleted", response_model=List[UserTrashResponse])
@limiter.limit(_GENERAL_LIMIT)
async def list_deleted_users(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List deleted accounts still inside the restore window (Admin only)

    Declared before ``/{user_id}`` on purpose: that path parameter is an int, so
    its route would swallow "deleted" (422) if it were registered first.
    """
    user_service = UserService(db)
    await user_service.purge_expired_users()

    users = await user_service.get_deleted_users(skip=skip, limit=limit)
    now = utcnow()

    deleted: List[UserTrashResponse] = []
    for user in users:
        # The query already filters on deleted_at, so this only narrows the type
        # for the arithmetic below.
        if user.deleted_at is None:
            continue
        expires = purge_at(user.deleted_at)
        deleted.append(
            UserTrashResponse(
                **UserResponse.model_validate(user).model_dump(),
                days_remaining=max(0, math.ceil((expires - now).total_seconds() / 86400)),
                purge_at=expires,
            )
        )

    return deleted


@router.get("/pending", response_model=List[UserResponse])
@limiter.limit(_GENERAL_LIMIT)
async def list_pending_users(
    request: Request,
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List sign-up requests waiting for a decision (Admin only)

    Declared before ``/{user_id}`` on purpose — that path parameter is an int, so
    its route would swallow "pending" (422) if it were registered first.
    """
    user_service = UserService(db)
    users = await user_service.get_pending_users(skip=skip, limit=limit)
    response.headers["X-Total-Count"] = str(await user_service.count_pending_users())
    return users


@router.post("/{user_id}/approve", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def approve_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Approve a sign-up request (Admin only)

    The account becomes usable and can sign in; the decision is audit-logged.
    """
    user_service = UserService(db)
    approved = await user_service.approve_user(user_id)

    if approved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบคำขอสมัครที่รออนุมัติสำหรับบัญชีนี้",
        )

    audit_service = AuditService(db)
    await audit_service.log_action(
        action="ADMIN_USER_APPROVE",
        user_id=current_user.id,
        details=(
            f"Admin approved sign-up request: "
            f"{approved.email or approved.username or approved.name} (ID: {user_id})"
        ),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    # Best-effort notice to the applicant; the decision stands even if email
    # delivery fails (the admin can always tell them another way).
    await db.commit()
    if approved.email:
        await email_service.get_email_service().send(
            email_service.account_approved_email(
                approved.email,
                approved.name or "",
                f"{settings.FRONTEND_BASE_URL}/login",
            )
        )

    return ResponseModel(
        result="success",
        message="อนุมัติบัญชีผู้ใช้สำเร็จ",
        data={"user_id": approved.id, "status": approved.status},
    )


@router.post("/{user_id}/reject", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def reject_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Refuse a sign-up request (Admin only)

    The account stays in the database as ``rejected`` (so the decision is visible
    and the address is not silently reusable) but can never sign in.
    """
    user_service = UserService(db)
    rejected = await user_service.reject_user(user_id)

    if rejected is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบคำขอสมัครที่รออนุมัติสำหรับบัญชีนี้",
        )

    audit_service = AuditService(db)
    await audit_service.log_action(
        action="ADMIN_USER_REJECT",
        user_id=current_user.id,
        details=(
            f"Admin rejected sign-up request: "
            f"{rejected.email or rejected.username or rejected.name} (ID: {user_id})"
        ),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    # Best-effort notice to the applicant; the decision stands even if email
    # delivery fails (the admin can always tell them another way).
    await db.commit()
    if rejected.email:
        await email_service.get_email_service().send(
            email_service.account_rejected_email(rejected.email, rejected.name or "")
        )

    return ResponseModel(
        result="success",
        message="ปฏิเสธคำขอสมัครแล้ว",
        data={"user_id": rejected.id, "status": rejected.status},
    )


@router.get("/{user_id}", response_model=UserResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_user(
    request: Request,
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


@router.post("", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ResponseModel, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@limiter.limit(_GENERAL_LIMIT)
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
        user = await user_service.create_user(
            user_create, role=user_create.role
        )

        await audit_service.log_action(
            action="ADMIN_USER_CREATE",
            user_id=current_user.id,
            details=f"Admin created user: {user.email} (ID: {user.id}) with role: {user.role}",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        # user_service.create_user() already committed the user; this commit is
        # what persists the audit row (log_action only adds to the session).
        await db.commit()

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
@limiter.limit(_GENERAL_LIMIT)
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
@limiter.limit(_GENERAL_LIMIT)
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
        if user_update.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="คุณไม่สามารถระงับการใช้งานบัญชีของตัวเองได้เพื่อป้องกันระบบล็อคถาวร",
            )
        if user_update.role is not None and user_update.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="คุณไม่สามารถเปลี่ยนบทบาทของตัวเองออกจากสิทธิ์ผู้ดูแลระบบได้",
            )

    user_service = UserService(db)

    # Safeguard: the deployment must always keep one usable admin. Losing the
    # last one cannot be undone from the UI, because nobody would be left with
    # the rights to grant them back.
    target_user = await user_service.get_user_by_id(user_id)
    if target_user is not None and target_user.role == "admin":
        removes_admin_access = (
            (user_update.role is not None and user_update.role != "admin")
            or user_update.is_active is False
            or user_update.is_locked is True
        )
        if removes_admin_access and await user_service.count_active_admins(
            exclude_user_id=user_id
        ) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 บัญชี — "
                    "ไม่สามารถลดสิทธิ์/ปิดใช้งาน/ล็อกผู้ดูแลระบบคนสุดท้ายได้"
                ),
            )

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        updated_user = await user_service.admin_update_user(user_id, user_update)

        changed_fields = [
            key for key, value in user_update.model_dump(exclude_unset=True).items() if value is not None
        ]
        await audit_service.log_action(
            action="ADMIN_USER_UPDATE",
            user_id=current_user.id,
            details=(
                f"Admin updated user {updated_user.email or updated_user.username} "
                f"(ID: {user_id}). Fields: {', '.join(changed_fields)}"
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
@limiter.limit(_GENERAL_LIMIT)
async def delete_user(
    user_id: int,
    request: Request,
    purge: bool = Query(
        False,
        description="ลบบัญชีถาวรทันที — ใช้ได้เฉพาะบัญชีที่อยู่ในถังขยะแล้ว",
    ),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete user (Admin only)

    By default the account is moved to the trash: it is hidden, locked out and
    its sessions are revoked, but an admin can restore it for
    ``settings.USER_DELETE_RETENTION_DAYS`` days. ``?purge=true`` erases a
    trashed account immediately and permanently instead.
    """
    # Safeguard: Prevent self-targeting admin deletion that would cause system lockout
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="คุณไม่สามารถลบบัญชีผู้ใช้ของตัวเองได้เพื่อป้องกันระบบล็อคถาวร",
        )

    user_service = UserService(db)

    # Get user email/username before deletion for logging
    target_user = await user_service.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Safeguard: deleting the last usable admin leaves nobody able to manage the
    # deployment, and the UI has no way to undo that.
    if (
        target_user.role == "admin"
        and target_user.deleted_at is None
        and await user_service.count_active_admins(exclude_user_id=user_id) == 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 บัญชี — "
                "ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้"
            ),
        )

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    target_identifier = target_user.email or target_user.username or f"ID {user_id}"

    if purge:
        # Only a trashed account may be erased, so a permanent delete is always a
        # deliberate second step rather than a typo in a query string.
        if target_user.deleted_at is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ต้องย้ายบัญชีเข้าถังขยะก่อนจึงจะลบถาวรได้",
            )
        if not await user_service.delete_user(user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        action = "ADMIN_USER_PURGE"
        details = f"Admin permanently deleted user: {target_identifier} (ID: {user_id})"
        message = "ลบผู้ใช้ถาวรสำเร็จ"
    else:
        if await user_service.soft_delete_user(user_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        action = "ADMIN_USER_DELETE"
        details = (
            f"Admin deleted user: {target_identifier} (ID: {user_id}) "
            f"— restorable for {retention_days()} days"
        )
        message = f"ย้ายบัญชีเข้าถังขยะแล้ว — กู้คืนได้ภายใน {retention_days()} วัน"

    await audit_service.log_action(
        action=action,
        user_id=current_user.id,
        details=details,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    await db.commit()

    return ResponseModel(
        result="success",
        message=message,
        data={"user_id": user_id, "purged": purge, "retention_days": retention_days()},
    )


@router.post("/{user_id}/restore", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def restore_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Restore a deleted account from the trash (Admin only)
    """
    user_service = UserService(db)
    restored = await user_service.restore_user(user_id)

    if restored is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบบัญชีนี้ในถังขยะ",
        )

    audit_service = AuditService(db)
    await audit_service.log_action(
        action="ADMIN_USER_RESTORE",
        user_id=current_user.id,
        details=(
            f"Admin restored user: {restored.email or restored.username} (ID: {user_id})"
        ),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseModel(
        result="success",
        message="กู้คืนผู้ใช้สำเร็จ",
        data={"user_id": restored.id, "is_active": restored.is_active},
    )
