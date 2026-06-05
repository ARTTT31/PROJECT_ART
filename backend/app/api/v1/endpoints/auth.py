"""
Authentication Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.user import UserLogin, UserCreate, UserResponse
from app.schemas.token import Token
from app.schemas.response import ResponseModel
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login", response_model=ResponseModel)
async def login(
    user_login: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Login endpoint
    
    Returns JWT access token and refresh token
    """
    import traceback
    
    auth_service = AuthService(db)
    
    # Get client IP
    client_ip = request.client.host if request.client else None
    
    try:
        result = auth_service.login(
            email=user_login.email,
            password=user_login.password,
            session_id=user_login.session_id,
            user_agent=user_login.user_agent,
            device_label=user_login.device_label,
            ip_address=client_ip,
        )
        
        return ResponseModel(
            result="success",
            message="เข้าสู่ระบบสำเร็จ",
            data=result,
        )
    
    except HTTPException as e:
        print(f"[LOGIN] HTTPException: {e.status_code} - {e.detail}")
        raise e
    except Exception as e:
        print(f"[LOGIN] Exception: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/register", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def register(
    user_create: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Register new user
    
    Note: In production, you may want to restrict this endpoint
    or add email verification
    """
    auth_service = AuthService(db)
    
    try:
        user = auth_service.register(user_create)
        
        return ResponseModel(
            result="success",
            message="ลงทะเบียนสำเร็จ",
            data={"user_id": user.id, "email": user.email},
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    """
    Refresh access token using refresh token
    """
    auth_service = AuthService(db)
    
    try:
        new_tokens = auth_service.refresh_access_token(refresh_token)
        return new_tokens
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/logout", response_model=ResponseModel)
async def logout(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Logout and invalidate session
    """
    auth_service = AuthService(db)
    
    try:
        auth_service.logout(session_id)
        
        return ResponseModel(
            result="success",
            message="ออกจากระบบสำเร็จ",
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
