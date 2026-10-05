"""
FastAPI Main Application
ART Workspace Backend
"""

import os
import secrets
from contextlib import asynccontextmanager
from http.cookies import SimpleCookie

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.datastructures import Headers

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
                print("[DB WARNING] Running legacy schema repair; use Alembic migrations in production.")
                await conn.run_sync(sync_db_columns)

    except Exception as e:
        print(f"[STARTUP DB SYNC NOTICE] {e}")
    yield
# CORS is explicit because authenticated cookies must never be shared with
# arbitrary preview deployments. Set CORS_ORIGINS in the production host.
allowed_origins = [origin.rstrip("/") for origin in settings.get_cors_origins() if origin.strip()]


# ── Content Security Policy (CSP) Middleware ──
# Two tiers:
#   PRODUCTION (DEBUG=False) — strict: no 'unsafe-eval', minimal origins
#   DEVELOPMENT (DEBUG=True) — permissive enough for Next.js HMR + hot reload
_CSP_SCRIPT_GOOGLE = "https://apis.google.com https://accounts.google.com"

# Explicitly-trusted connect origins (frontend API backend + Google auth flows).
# Widgets that call third-party endpoints (weather etc.) should do so via the
# backend proxy to keep this list tight.
# Each allowed frontend origin also gets its WebSocket counterpart so live
# features keep working without a blanket `https:` / `wss:` wildcard.
_CSP_ORIGINS = [o for o in allowed_origins if o.startswith(("https://", "http://"))]
_CSP_WS_ORIGINS = [
    o.replace("https://", "wss://").replace("http://", "ws://")
    for o in _CSP_ORIGINS
]
_CSP_CONNECT_TRUSTED = " ".join(["'self'", *_CSP_ORIGINS, *_CSP_WS_ORIGINS])
# Note: third-party hosts are intentionally NOT wildcarded here. The dashboard
# widgets proxy their data through the backend, so browser connect-src only needs
# the API origin (plus its WebSocket variant) and the documented frontend origin.
# If a browser feature ever needs an extra host, add it explicitly to CORS_ORIGINS
# or extend this list — do not reintroduce a bare `https:`.

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
                set_header(b"referrer-policy", b"strict-origin-when-cross-origin")
                set_header(b"permissions-policy", b"camera=(self), microphone=(), geolocation=(self)")
                # HSTS is meaningless (and harmful) on plain-HTTP local development,
                # so it is only sent by non-DEBUG deployments.
                if not settings.DEBUG:
                    set_header(
                        b"strict-transport-security",
                        b"max-age=63072000; includeSubDomains; preload",
                    )
                message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_wrapper)


# Interactive docs expose the full API surface, so they stay behind an explicit
# opt-in (ENABLE_API_DOCS) and are on automatically for local DEBUG runs.
_docs_enabled = settings.ENABLE_API_DOCS or settings.DEBUG

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="ART Workspace API - Modern Stack Migration",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore


class CSRFMiddleware:
    """Double-submit-cookie CSRF protection for cookie-authenticated requests.

    Only mutating (`POST`/`PUT`/`PATCH`/`DELETE`) requests under `/api/` are
    checked. A readable `csrf_token` cookie is issued on first response and the
    caller must echo the same value back in the `X-CSRF-Token` header; otherwise
    the request is rejected with 403.

    Pre-authentication endpoints are exempt because no CSRF cookie can exist
    before the first login, and `/auth/refresh` is exempt so an expired session
    can always be renewed instead of locking the user out.
    """

    COOKIE_NAME = "csrf_token"
    HEADER_NAME = "x-csrf-token"
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    EXEMPT_PREFIXES = (
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/google",
        "/api/v1/auth/csrf",
    )

    def __init__(self, app):
        self.app = app

    @classmethod
    def _is_exempt(cls, path: str) -> bool:
        return any(
            path == prefix or path.startswith(prefix + "/")
            for prefix in cls.EXEMPT_PREFIXES
        )

    @classmethod
    def _cookie_header(cls, token: str) -> bytes:
        max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        parts = [
            f"{cls.COOKIE_NAME}={token}",
            "Path=/",
            f"Max-Age={max_age}",
            f"SameSite={str(settings.COOKIE_SAMESITE).lower()}",
        ]
        if settings.COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts).encode("latin-1")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "GET").upper()
        headers = Headers(scope=scope)

        jar = SimpleCookie()
        try:
            jar.load(headers.get("cookie", ""))
        except Exception:
            pass
        cookie_token = jar[self.COOKIE_NAME].value if self.COOKIE_NAME in jar else None

        # Only requests that already carry an authenticated browser session can
        # be forged, so anonymous calls are left alone and keep returning their
        # normal 401 instead of a confusing 403.
        has_session_context = bool(
            cookie_token
            or "access_token" in jar
            or "refresh_token" in jar
        )

        needs_check = (
            settings.CSRF_PROTECTION_ENABLED
            and path.startswith("/api/")
            and method not in self.SAFE_METHODS
            and not self._is_exempt(path)
            and has_session_context
        )

        if needs_check:
            supplied = headers.get(self.HEADER_NAME)
            if (
                not cookie_token
                or not supplied
                or not secrets.compare_digest(str(supplied), str(cookie_token))
            ):
                response = JSONResponse(
                    status_code=403,
                    content={
                        "detail": "CSRF token missing or invalid",
                        "code": "csrf_failed",
                    },
                )
                if not cookie_token:
                    # Issue a token so the client can retry immediately.
                    response.raw_headers.append(
                        (b"set-cookie", self._cookie_header(secrets.token_urlsafe(32)))
                    )
                await response(scope, receive, send)
                return

        async def send_wrapper(message):
            if message["type"] == "http.response.start" and not cookie_token:
                raw_headers = list(message.get("headers", []))
                already_set = any(
                    name.lower() == b"set-cookie"
                    and self.COOKIE_NAME.encode() in value
                    for name, value in raw_headers
                )
                if not already_set:
                    raw_headers.append(
                        (b"set-cookie", self._cookie_header(secrets.token_urlsafe(32)))
                    )
                    message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


# Middleware registration order is REVERSED by Starlette: the LAST middleware
# added is the OUTERMOST. CSRF is added first so a rejected request still travels
# back out through CSP (security headers) and CORS (browser-readable 403).
app.add_middleware(CSRFMiddleware)
app.add_middleware(CSPMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
