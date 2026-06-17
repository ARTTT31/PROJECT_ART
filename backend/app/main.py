"""
FastAPI Main Application
ART Workspace Backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.core.database import engine
from app.models import base  # Import all models
from fastapi.staticfiles import StaticFiles

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables asynchronously on startup
    async with engine.begin() as conn:
        await conn.run_sync(base.Base.metadata.create_all)
    yield

# Rate Limiter - Uses X-Forwarded-For to get real client IP behind proxy (Render/Vercel)
def get_real_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_real_client_ip)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="ART Workspace API - Modern Stack Migration",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware — explicit origins + regex for Vercel preview URLs
# allow_credentials=True requires explicit origins (no wildcard "*")
allowed_origins = settings.get_cors_origins()
vercel_prod_origin = "https://project-art-sigma.vercel.app"
if vercel_prod_origin not in allowed_origins:
    allowed_origins.append(vercel_prod_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://(project-art|art-workspace)-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - Health check"""
    return {
        "message": "ART Workspace API",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
        },
    )


# ── Content Security Policy (CSP) Middleware ──
CSP_HEADER_VALUE = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://apis.google.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "img-src 'self' data: https:; "
    "font-src 'self' https://fonts.gstatic.com; "
    "connect-src 'self' https://www.eppo.go.th https://calendar.google.com; "
    "frame-src 'self' https://accounts.google.com; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

class CSPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = CSP_HEADER_VALUE
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(CSPMiddleware)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Mount uploads static folder
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8080,
        reload=settings.DEBUG,
    )
