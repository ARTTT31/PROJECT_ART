"""
User Profile Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.schemas.user import (
    UserResponse,
    UserUpdate,
    UserPasswordChange,
    UserAvatarUpdate,
    UserQuickLinksUpdate,
)
from app.schemas.response import ResponseModel
from app.services.user_service import UserService
from app.api.dependencies import get_current_user
from app.models.user import User

import base64
import os
from app.services.audit_service import AuditService
from app.models.session import UserSession

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Get current user profile
    """
    return current_user


@router.put("/me", response_model=ResponseModel)
async def update_my_profile(
    user_update: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update current user profile
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        updated_user = await user_service.update_user(current_user.id, user_update)

        await audit_service.log_action(
            action="PROFILE_UPDATE",
            user_id=current_user.id,
            details=(
                f"Updated profile fields: "
                f"{', '.join([k for k, v in user_update.dict(exclude_unset=True).items() if v is not None])}"
            ),
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return ResponseModel(
            result="success",
            message="อัปเดตโปรไฟล์สำเร็จ",
            data={
                "user_id": updated_user.id,
                "email": updated_user.email,
                "name": updated_user.name,
            },
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/change-password", response_model=ResponseModel)
async def change_password(
    password_change: UserPasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change current user password
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        success = await user_service.change_password(
            user_id=current_user.id,
            old_password=password_change.old_password,
            new_password=password_change.new_password,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="รหัสผ่านเดิมไม่ถูกต้อง",
            )

        await audit_service.log_action(
            action="PASSWORD_CHANGE",
            user_id=current_user.id,
            details="User successfully changed password",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return ResponseModel(
            result="success",
            message="เปลี่ยนรหัสผ่านสำเร็จ",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/avatar", response_model=ResponseModel)
async def update_avatar(
    avatar_update: UserAvatarUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user avatar (base64 encoded image)
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        await user_service.update_avatar(current_user.id, avatar_update.avatar_base64)

        await audit_service.log_action(
            action="AVATAR_UPDATE",
            user_id=current_user.id,
            details="User successfully updated avatar image",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return ResponseModel(
            result="success",
            message="อัปเดตรูปโปรไฟล์สำเร็จ",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/upload-avatar", response_model=ResponseModel)
async def upload_avatar_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload user avatar and store as Base64 in Database (Serverless Friendly)
    """
    # 1. Check file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif"]:
        raise HTTPException(
            status_code=400, detail="รองรับเฉพาะไฟล์รูปภาพ (jpg, jpeg, png, gif)"
        )

    try:
        # 2. Read contents and limit size to 1MB
        contents = await file.read()
        if len(contents) > 1 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="ขนาดไฟล์รูปภาพห้ามเกิน 1MB")

        # 3. Convert image to Base64 Data URL string
        base64_data = base64.b64encode(contents).decode("utf-8")
        avatar_base64 = f"data:{file.content_type};base64,{base64_data}"

        # 4. Save to Database (Async Service Call)
        user_service = UserService(db)
        await user_service.update_avatar(current_user.id, avatar_base64)

        # 5. Log audit trail (Sync Service Call)
        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[
            0
        ].strip() or (request.client.host if request.client else None)
        user_agent = request.headers.get("user-agent")

        audit_service = AuditService(db)
        await audit_service.log_action(
            action="AVATAR_UPLOAD",
            user_id=current_user.id,
            details="User successfully uploaded and stored avatar image in database",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        return ResponseModel(
            result="success",
            message="อัปเดตรูปโปรไฟล์สำเร็จ (เก็บข้อมูลบนระบบคลาวด์แล้ว)",
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ไม่สามารถอัปโหลดไฟล์ได้: {str(e)}",
        )


@router.post("/quick-links", response_model=ResponseModel)
async def update_quick_links(
    quick_links_update: UserQuickLinksUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user quick links (JSON string)
    """
    user_service = UserService(db)

    try:
        await user_service.update_quick_links(
            current_user.id, quick_links_update.quick_links
        )

        return ResponseModel(
            result="success",
            message="อัปเดต Quick Links สำเร็จ",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/sessions", response_model=ResponseModel)
async def get_my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user session log history
    """

    try:
        result = await db.execute(
            select(UserSession)
            .filter(UserSession.user_id == current_user.id)
            .order_by(UserSession.created_at.desc())
            .limit(10)
        )
        sessions = result.scalars().all()

        session_data = [
            {
                "id": s.id,
                "session_id": s.session_id,
                "device_label": s.device_label or "Unknown Device",
                "user_agent": s.user_agent or None,
                "ip_address": s.ip_address or "Unknown IP",
                "is_active": s.is_active,
                "last_activity": s.last_activity.isoformat()
                if s.last_activity
                else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ]

        return ResponseModel(
            result="success",
            message="ดึงประวัติการเข้าใช้งานสำเร็จ",
            data=session_data,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/sessions/{session_id}", response_model=ResponseModel)
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke/delete a user session
    """

    try:
        result = await db.execute(
            select(UserSession).filter(
                UserSession.session_id == session_id,
                UserSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบประวัติเซสชันที่ระบุ"
            )

        session.is_active = False
        await db.commit()

        return ResponseModel(result="success", message="ออกจากระบบจากอุปกรณ์ที่เลือกสำเร็จ")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
