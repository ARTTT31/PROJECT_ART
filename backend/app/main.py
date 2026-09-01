"""
FastAPI Main Application
ART Workspace Backend
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.rate_limit import limiter
from app.api.v1.router import api_router
from app.core.database import engine
from app.models import base  # Import all models
from fastapi.staticfiles import StaticFiles

# ═══════════════════════════════════════════════════════════════════════════════
# Optional: Sentry Error Monitoring (only activates when SENTRY_DSN is set)
# Wrapped in try/except because sentry-sdk may not be installed in every env.
# ═══════════════════════════════════════════════════════════════════════════════
_SENTRY_INITIALIZED = False
try:
    if settings.SENTRY_DSN:
        import sentry_sdk  # type: ignore
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # type: ignore
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration  # type: ignore

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.SENTRY_ENVIRONMENT,
            release=os.environ.get("RENDER_GIT_COMMIT") or settings.APP_VERSION,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
            send_default_pii=False,  # Never attach user IP/emails by default
            integrations=[
                FastApiIntegration(transaction_style="url"),
                SqlalchemyIntegration(),
            ],
        )
        _SENTRY_INITIALIZED = True
        print(f"[MONITOR] Sentry initialized (env={settings.SENTRY_ENVIRONMENT})")
    else:
        print("[MONITOR] Sentry disabled — set SENTRY_DSN to enable error monitoring.")
except ImportError:  # pragma: no cover
    if settings.SENTRY_DSN:
        print("[MONITOR] WARNING: SENTRY_DSN is set but sentry-sdk is not installed. "
              "Run `pip install 'sentry-sdk[fastapi]'` to enable.")
except Exception as exc:  # pragma: no cover
    print(f"[MONITOR] WARNING: Sentry init failed ({exc}). Continuing without monitoring.")


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
                    sync_conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                    print(f"[DB AUTO-MIGRATE] Added column {col_name} to users table")
                except Exception:
                    try:
                        sync_conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        print(f"[DB AUTO-MIGRATE] Added column {col_name} to users table (fallback)")
                    except Exception as e:
                        print(f"[DB AUTO-MIGRATE] Notice adding column {col_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            if settings.AUTO_CREATE_TABLES:
                if settings.DEBUG:
                    print("[DB] AUTO_CREATE_TABLES=True: Creating tables (dev-only convenience)")
                else:
                    print("[DB WARNING] AUTO_CREATE_TABLES=True in non-DEBUG mode! "
                          "Prefer Alembic migrations in production.")
                await conn.run_sync(base.Base.metadata.create_all)

            if settings.AUTO_MIGRATE_COLUMNS:
                if settings.DEBUG:
                    print("[DB] AUTO_MIGRATE_COLUMNS=True: Syncing columns (dev-only convenience)")
                else:
                    print("[DB WARNING] AUTO_MIGRATE_COLUMNS=True in non-DEBUG mode! "
                          "Prefer Alembic migrations in production — unsafe ALTER TABLE on live data.")
                await conn.run_sync(sync_db_columns)
            elif not settings.DEBUG:
                print("[DB] Production mode: Column auto-sync DISABLED. "
                      "Run `alembic upgrade head` to apply migrations.")
    except Exception as e:
        print(f"[STARTUP DB SYNC NOTICE] {e}")
    yield


# CORS Origins — built early so the CSP connect-src directive can trust them.
# allow_credentials=True requires explicit origins (no wildcard "*").
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


# ── Content Security Policy (CSP) Middleware ──
# Two tiers:
#   PRODUCTION (DEBUG=False) — strict: no 'unsafe-eval', minimal origins
#   DEVELOPMENT (DEBUG=True) — permissive enough for Next.js HMR + hot reload
_CSP_SCRIPT_GOOGLE = "https://apis.google.com https://accounts.google.com"

# Explicitly-trusted connect origins (frontend API backend + Google auth flows).
# Widgets that call third-party endpoints (weather etc.) should do so via the
# backend proxy to keep this list tight.
_CSP_CONNECT_TRUSTED = (
    "'self' "
    + " ".join(
        o for o in allowed_origins
        if o.startswith(("https://", "http://", "capacitor://", "ionic://"))
    )
    + " wss: https: data:"
)
# Note: `https:` is kept in connect-src as a pragmatic fallback because the
# dashboard widgets proxy data server-side but some browser features (OAuth
# popups, analytics, WebSockets) need to connect to arbitrary HTTPS hosts.
# If the deployment is fully locked down, replace the trailing `https:` with
# an explicit enumeration of allowed third-party hostnames.

CSP_HEADER_VALUE_PROD = (
    # default-src fallback: self-only (no unsafe-eval), plus fonts/images data/blob
    f"default-src 'self' data: blob:; "
    # script-src: keep 'unsafe-inline' (Next.js inline bootstrap), NO unsafe-eval
    f"script-src 'self' 'unsafe-inline' {_CSP_SCRIPT_GOOGLE}; "
    # style-src: 'unsafe-inline' required for Tailwind / Radix style injection
    f"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    # images + media: permissive for avatars / widget visuals
    f"img-src 'self' data: https: blob:; "
    f"media-src 'self' data: https: blob:; "
    # fonts: Google Fonts + data:
    f"font-src 'self' https://fonts.gstatic.com data:; "
    # connect: explicit trusted origins + wss for live features
    f"connect-src {_CSP_CONNECT_TRUSTED}; "
    # frames: only Google OAuth popup
    f"frame-src 'self' https://accounts.google.com; "
    # workers / manifests
    f"worker-src 'self' blob:; "
    f"manifest-src 'self'; "
    # Hard blocks
    f"object-src 'none'; "
    f"base-uri 'self'; "
    f"form-action 'self'; "
    f"frame-ancestors 'none'; "
)

CSP_HEADER_VALUE_DEV = (
    # Dev-only: allow 'unsafe-eval' + looser defaults for Next.js HMR / Fast Refresh
    f"default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; "
    f"script-src 'self' 'unsafe-inline' 'unsafe-eval' {_CSP_SCRIPT_GOOGLE}; "
    f"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    f"img-src 'self' data: https: blob:; "
    f"font-src 'self' https://fonts.gstatic.com data:; "
    f"connect-src 'self' https: wss: http: ws:; "
    f"frame-src 'self' https://accounts.google.com; "
    f"object-src 'none'; "
    f"base-uri 'self'; "
    f"form-action 'self'; "
)

CSP_HEADER_VALUE = CSP_HEADER_VALUE_DEV if settings.DEBUG else CSP_HEADER_VALUE_PROD


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
