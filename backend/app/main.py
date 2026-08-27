"""
FastAPI Main Application
ART Workspace Backend
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.v1.router import api_router
from app.core.database import engine
from app.models import base  # Import all models
from fastapi.staticfiles import StaticFiles


def sync_db_columns(sync_conn):
    from sqlalchemy import inspect, text
    inspector = inspect(sync_conn)
    tables = inspector.get_table_names()
    if "users" in tables:
        existing_cols = {c["name"] for c in inspector.get_columns("users")}
        columns_to_ensure = [
            ("dashboard_layout", "TEXT"),
            ("camera_config", "TEXT"),
            ("quick_links", "TEXT"),
            ("display_name", "VARCHAR(255)"),
            ("username", "VARCHAR(255)"),
            ("avatar", "TEXT"),
            ("last_login_ip", "VARCHAR(45)"),
            ("last_login_device", "VARCHAR(255)"),
            ("failed_login_attempts", "INTEGER DEFAULT 0"),
            ("locked_until", "TIMESTAMP"),
            ("is_locked", "BOOLEAN DEFAULT FALSE"),
        ]
        for col_name, col_type in columns_to_ensure:
            if col_name not in existing_cols:
                try:
                    sync_conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    print(f"[DB AUTO-MIGRATE] Added column {col_name} to users table")
                except Exception as e:
                    print(f"[DB AUTO-MIGRATE] Notice adding column {col_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(base.Base.metadata.create_all)
            await conn.run_sync(sync_db_columns)
    yield


# Rate Limiter - Uses X-Forwarded-For to get real client IP behind proxy (Render/Vercel)
def get_real_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=get_real_client_ip)


# ── Content Security Policy (CSP) Middleware ──
CSP_HEADER_VALUE = (
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
    "img-src 'self' data: https: blob:; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "connect-src 'self' https: wss:; "
    "frame-src 'self' https://accounts.google.com; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


class CSPMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Do not modify OPTIONS preflight responses so CORSMiddleware handles them cleanly
        if scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))

                def set_header(name: bytes, value: bytes):
                    for idx, (h_name, h_val) in enumerate(headers):
                        if h_name.lower() == name.lower():
                            headers[idx] = (name, value)
                            return
                    headers.append((name, value))

                set_header(b"content-security-policy", CSP_HEADER_VALUE.encode("utf-8"))
                set_header(b"x-content-type-options", b"nosniff")
                set_header(b"x-frame-options", b"DENY")
                set_header(b"x-xss-protection", b"1; mode=block")
                set_header(b"referrer-policy", b"strict-origin-when-cross-origin")
                set_header(b"permissions-policy", b"camera=(), microphone=(), geolocation=()")
                message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_wrapper)


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

# CORS Middleware — explicit origins + regex for all Vercel domains
# allow_credentials=True requires explicit origins (no wildcard "*")
base_origins = [
    "https://project-art-sigma.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8000",
    "http://localhost",
    "capacitor://localhost",
    "ionic://localhost",
    "null",
]

allowed_origins = list(base_origins)
for origin in settings.get_cors_origins():
    cleaned = origin.rstrip("/")
    if cleaned and cleaned not in allowed_origins:
        allowed_origins.append(cleaned)

# Middleware registration order is REVERSED by Starlette:
# CORSMiddleware is added LAST so it wraps CSPMiddleware and executes FIRST.
app.add_middleware(CSPMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
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


@app.options("/api/v1/auth/google/verify-token", include_in_schema=False)
async def preflight_google_verify_token(request: Request):
    """Explicit OPTIONS handler for Google verify-token preflight.
    This is a safety-net: CORSMiddleware should handle preflights automatically,
    but some mobile WebView environments require this explicit route to exist.
    """
    origin = request.headers.get("origin", "")
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin or "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
        },
    )


@app.options("/api/v1/auth/microsoft/verify-token", include_in_schema=False)
async def preflight_microsoft_verify_token(request: Request):
    """Explicit OPTIONS handler for Microsoft verify-token preflight.
    This is a safety-net: CORSMiddleware should handle preflights automatically,
    but some mobile WebView environments require this explicit route to exist.
    """
    origin = request.headers.get("origin", "")
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin or "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
        },
    )


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


# NOTE: CSPMiddleware class is defined above (before app creation) so it can be
# referenced in the middleware registration block without a NameError.

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
