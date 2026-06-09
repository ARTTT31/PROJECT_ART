"""
API v1 Router
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, profile, calendar, audit

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])
