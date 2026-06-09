"""
User Management Endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.user import UserResponse, UserCreate, UserAdminUpdate
from app.schemas.response import ResponseModel
from app.services.user_service import UserService
from app.api.dependencies import get_current_admin_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    List all users (Admin only)
    """
    user_service = UserService(db)
    users = user_service.get_users(skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get user by ID (Admin only)
    """
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)
    
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
    db: Session = Depends(get_db),
):
    """
    Create new user (Admin only)
    """
    user_service = UserService(db)
    from app.services.audit_service import AuditService
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    try:
        user = user_service.create_user(user_create)
        
        audit_service.log_action(
            action="ADMIN_USER_CREATE",
            user_id=current_user.id,
            details=f"Admin created user: {user.email} (ID: {user.id}) with role: {user.role}",
            ip_address=client_ip,
            user_agent=user_agent
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


@router.put("/{user_id}", response_model=ResponseModel)
async def update_user(
    user_id: int,
    user_update: UserAdminUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update user settings (Admin only)
    """
    user_service = UserService(db)
    from app.services.audit_service import AuditService
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    try:
        updated_user = user_service.admin_update_user(user_id, user_update)
        
        audit_service.log_action(
            action="ADMIN_USER_UPDATE",
            user_id=current_user.id,
            details=f"Admin updated user {updated_user.email} (ID: {user_id}). Fields: {', '.join([k for k, v in user_update.dict(exclude_unset=True).items() if v is not None])}",
            ip_address=client_ip,
            user_agent=user_agent
        )
        
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
    db: Session = Depends(get_db),
):
    """
    Delete user (Admin only)
    """
    user_service = UserService(db)
    from app.services.audit_service import AuditService
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    # Get user email before deletion for logging
    target_user = user_service.get_user_by_id(user_id)
    target_email = target_user.email if target_user else f"ID {user_id}"
    
    success = user_service.delete_user(user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
        
    audit_service.log_action(
        action="ADMIN_USER_DELETE",
        user_id=current_user.id,
        details=f"Admin deleted user: {target_email} (ID: {user_id})",
        ip_address=client_ip,
        user_agent=user_agent
    )
    
    return ResponseModel(
        result="success",
        message="ลบผู้ใช้สำเร็จ",
    )
