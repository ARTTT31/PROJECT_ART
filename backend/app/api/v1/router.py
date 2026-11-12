"""
API v1 Router
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    profile,
    audit,
    market,
    oil_prices,
    football,
    system,
    weather,
    websockets,
    planner,
    notifications,
    ai,
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])
api_router.include_router(oil_prices.router, prefix="/oil-prices", tags=["Oil Prices"])
api_router.include_router(football.router, prefix="/football", tags=["Football"])
api_router.include_router(market.router, prefix="/market", tags=["Market Summary"])
api_router.include_router(weather.router, prefix="/weather", tags=["Weather & Geocode"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
api_router.include_router(planner.router, prefix="/planner", tags=["Planner"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)
api_router.include_router(websockets.router, prefix="/ws", tags=["WebSockets"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Copilot"])
