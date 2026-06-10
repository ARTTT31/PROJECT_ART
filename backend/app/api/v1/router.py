"""
API v1 Router
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, profile, calendar, audit, oil_prices, system

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])
api_router.include_router(oil_prices.router, prefix="/oil-prices", tags=["Oil Prices"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
