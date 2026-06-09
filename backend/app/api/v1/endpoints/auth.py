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
    from app.services.audit_service import AuditService
    audit_service = AuditService(db)
    
    # Get client IP & User Agent
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    try:
        result = auth_service.login(
            email=user_login.email,
            password=user_login.password,
            session_id=user_login.session_id,
            user_agent=user_login.user_agent,
            device_label=user_login.device_label,
            ip_address=client_ip,
        )
        
        # Log success
        audit_service.log_action(
            action="LOGIN_SUCCESS",
            user_id=result["user"]["id"],
            details=f"User logged in using {user_login.device_label or 'unknown device'}",
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        return ResponseModel(
            result="success",
            message="เข้าสู่ระบบสำเร็จ",
            data=result,
        )
    
    except HTTPException as e:
        print(f"[LOGIN] HTTPException: {e.status_code} - {e.detail}")
        # Log failure
        audit_service.log_action(
            action="LOGIN_FAILED",
            details=f"Failed login attempt for {user_login.email}: {e.detail}",
            ip_address=client_ip,
            user_agent=user_agent
        )
        raise e
    except Exception as e:
        print(f"[LOGIN] Exception: {str(e)}")
        print(traceback.format_exc())
        # Log failure error
        audit_service.log_action(
            action="LOGIN_FAILED",
            details=f"System error during login for {user_login.email}: {str(e)}",
            ip_address=client_ip,
            user_agent=user_agent
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/register", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def register(
    user_create: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Register new user
    
    Note: In production, you may want to restrict this endpoint
    or add email verification
    """
    auth_service = AuthService(db)
    from app.services.audit_service import AuditService
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    try:
        user = auth_service.register(user_create)
        
        # Log register success
        audit_service.log_action(
            action="USER_REGISTER",
            user_id=user.id,
            details=f"User self-registered with email: {user.email}",
            ip_address=client_ip,
            user_agent=user_agent
        )
        
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


@router.get("/google")
async def google_login(request: Request):
    """Redirect to Google's OAuth 2.0 consent screen"""
    import os
    from urllib.parse import urlencode

    client_id = os.getenv('BACKEND_GOOGLE_CLIENT_ID')
    redirect_uri = os.getenv('BACKEND_GOOGLE_REDIRECT', 'http://localhost:8000/api/v1/auth/google/callback')

    if not client_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google client ID not configured")

    params = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'openid email profile',
        'access_type': 'offline',
        'prompt': 'select_account',
    }

    url = f'https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}'
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(code: str = None, request: Request = None, db: Session = Depends(get_db)):
    """Handle callback from Google, create/find user, issue JWT via secure HTTP-only cookies"""
    import os
    import requests
    import json
    from app.services.user_service import UserService
    from app.core.security import create_access_token, create_refresh_token

    client_id = os.getenv('BACKEND_GOOGLE_CLIENT_ID')
    client_secret = os.getenv('BACKEND_GOOGLE_CLIENT_SECRET')
    redirect_uri = os.getenv('BACKEND_GOOGLE_REDIRECT', 'http://localhost:8000/api/v1/auth/google/callback')
    frontend_redirect = os.getenv('FRONTEND_URL', 'http://localhost:3001')

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Missing code from Google')

    # Exchange code for tokens
    token_url = 'https://oauth2.googleapis.com/token'
    data = {
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }

    token_resp = requests.post(token_url, data=data, timeout=10)
    if token_resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='Failed to exchange code for token')

    token_json = token_resp.json()
    access_token = token_json.get('access_token')

    # Get user info
    userinfo_resp = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {access_token}'}, timeout=10)
    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='Failed to fetch user info from Google')

    profile = userinfo_resp.json()
    email = profile.get('email')
    name = profile.get('name') or profile.get('given_name') or ''

    # Find or create user
    user_service = UserService(db)
    user = user_service.get_user_by_email(email)
    if not user:
        from app.schemas.user import UserCreate
        # Create with a random password (not used)
        import secrets
        random_pwd = secrets.token_urlsafe(16)
        user_create = UserCreate(email=email, password=random_pwd, name=name, role='user')
        try:
            user = user_service.create_user(user_create)
        except Exception:
            # If creation failed, try fetching again
            user = user_service.get_user_by_email(email)

    # Issue tokens
    access_jwt = create_access_token(data={"sub": user.email, "user_id": user.id})
    refresh_jwt = create_refresh_token(data={"sub": user.email, "user_id": user.id})

    # Create response with tokens in query string for now (will migrate to cookies)
    from fastapi.responses import RedirectResponse
    from urllib.parse import urlencode
    import json
    
    user_data = {
        "id": user.id,
        "email": user.email,
        "name": name or user.name or "User",
        "role": user.role
    }
    
    params = {
        'access_token': access_jwt,
        'refresh_token': refresh_jwt,
        'user': json.dumps(user_data),
    }
    redirect_url = f"{frontend_redirect}/login-success?{urlencode(params)}"
    response = RedirectResponse(url=redirect_url)
    
    # Also set cookies as backup
    is_secure = frontend_redirect.startswith('https://')
    
    response.set_cookie(
        key="access_token",
        value=access_jwt,
        max_age=30 * 60,
        httponly=True,
        secure=is_secure,
        samesite="Lax",
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_jwt,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=is_secure,
        samesite="Lax",
        path="/"
    )
    response.set_cookie(
        key="user",
        value=json.dumps(user_data),
        max_age=7 * 24 * 60 * 60,
        httponly=False,
        secure=is_secure,
        samesite="Lax",
        path="/"
    )
    return response


@router.post("/logout", response_model=ResponseModel)
async def logout(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Logout and invalidate session
    """
    auth_service = AuthService(db)
    from app.services.audit_service import AuditService
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    try:
        # Get user ID from session if possible before revoking
        from app.models.session import UserSession
        session_obj = db.query(UserSession).filter(UserSession.session_id == session_id).first()
        user_id = session_obj.user_id if session_obj else None
        
        auth_service.logout(session_id)
        
        if user_id:
            audit_service.log_action(
                action="LOGOUT",
                user_id=user_id,
                details=f"Logged out session: {session_id}",
                ip_address=client_ip,
                user_agent=user_agent
            )
        
        return ResponseModel(
            result="success",
            message="ออกจากระบบสำเร็จ",
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
