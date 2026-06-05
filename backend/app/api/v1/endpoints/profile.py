"""
User Profile Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.user import UserResponse, UserUpdate, UserPasswordChange
from app.schemas.response import ResponseModel
from app.services.user_service import UserService
from app.api.dependencies import get_current_user
from app.models.user import User

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update current user profile
    """
    user_service = UserService(db)
    
    try:
        updated_user = user_service.update_user(current_user.id, user_update)
        
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change current user password
    """
    user_service = UserService(db)
    
    try:
        success = user_service.change_password(
            user_id=current_user.id,
            old_password=password_change.old_password,
            new_password=password_change.new_password,
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="รหัสผ่านเดิมไม่ถูกต้อง",
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
    avatar_base64: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update user avatar (base64 encoded image)
    """
    user_service = UserService(db)
    
    try:
        user_service.update_avatar(current_user.id, avatar_base64)
        
        return ResponseModel(
            result="success",
            message="อัปเดตรูปโปรไฟล์สำเร็จ",
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/quick-links", response_model=ResponseModel)
async def update_quick_links(
    quick_links: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update user quick links (JSON string)
    """
    user_service = UserService(db)
    
    try:
        user_service.update_quick_links(current_user.id, quick_links)
        
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
    db: Session = Depends(get_db),
):
    """
    Get user session log history
    """
    from app.models.session import UserSession
    try:
        sessions = (
            db.query(UserSession)
            .filter(UserSession.user_id == current_user.id)
            .order_by(UserSession.created_at.desc())
            .limit(10)
            .all()
        )
        
        session_data = [
            {
                "id": s.id,
                "session_id": s.session_id,
                "device_label": s.device_label or "Unknown Device",
                "ip_address": s.ip_address or "Unknown IP",
                "is_active": s.is_active,
                "last_activity": s.last_activity.isoformat() if s.last_activity else None,
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
    db: Session = Depends(get_db),
):
    """
    Revoke/delete a user session
    """
    from app.models.session import UserSession
    try:
        session = (
            db.query(UserSession)
            .filter(
                UserSession.session_id == session_id,
                UserSession.user_id == current_user.id
            )
            .first()
        )
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ไม่พบประวัติเซสชันที่ระบุ"
            )
            
        session.is_active = False
        db.commit()
        
        return ResponseModel(
            result="success",
            message="ออกจากระบบจากอุปกรณ์ที่เลือกสำเร็จ"
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
