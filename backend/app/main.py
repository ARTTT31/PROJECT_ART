"""
FastAPI Main Application
Workspace Backend
"""

import asyncio
import logging
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.middleware import CSPMiddleware, CSRFMiddleware
from app.core.observability import RequestIDMiddleware, configure_logging
from app.core.rate_limit import limiter
from app.api.v1.router import api_router
from app.api.v1.endpoints.websockets import manager as ws_manager
from app.models import base  # Import all models
from app.services.session_cleanup import cleanup_expired_sessions_async
from app.services.ws_bus import broadcast_bus

logger = logging.getLogger(__name__)

# Configure logging before anything else can log: the bootstrap notices below are
# emitted through this logger rather than through print().
configure_logging(settings.DEBUG)

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
        logger.info("Sentry initialized (env=%s)", settings.SENTRY_ENVIRONMENT)
    else:
        logger.info("Sentry disabled — set SENTRY_DSN to enable error monitoring.")
except ImportError:  # pragma: no cover
    if settings.SENTRY_DSN:
        logger.warning(
            "SENTRY_DSN is set but sentry-sdk is not installed. "
            "Run `pip install 'sentry-sdk[fastapi]'` to enable."
        )
except Exception as exc:  # pragma: no cover
    logger.warning("Sentry init failed (%s). Continuing without monitoring.", exc)


SHARED_STATE_NOTICE = (
    "[SCALING] {component} keeps its state in this process only. "
    "It is correct for the current single-instance deployment, but running more "
    "than one instance requires a shared backend (see README, "
    "\"Horizontal scaling\")."
)


def log_email_delivery_configuration() -> None:
    """Make a production deployment with no mail transport impossible to miss.

    Console mode is the right default for tests and local development, but in
    production it means reset/verification links are written to the logs and
    never reach the user. Log loudly instead of failing startup: an operator
    may still be completing provider setup, and a boot loop would be worse.
    """
    if settings.DEBUG:
        return
    backend = (settings.EMAIL_BACKEND or "console").strip().lower()
    if backend == "console":
        logger.warning(
            "EMAIL_BACKEND=console in production: email-verification links will NOT "
            "be delivered. Set EMAIL_BACKEND=resend or smtp."
        )
    elif backend == "resend" and not (settings.RESEND_API_KEY or "").strip():
        logger.warning("EMAIL_BACKEND=resend but RESEND_API_KEY is empty; email will not send.")
    elif backend == "smtp" and not (settings.SMTP_HOST or "").strip():
        logger.warning("EMAIL_BACKEND=smtp but SMTP_HOST is empty; email will not send.")

    if settings.GOOGLE_SIGNUP_ENABLED and not settings.GOOGLE_ALLOWED_DOMAINS:
        logger.warning(
            "GOOGLE_SIGNUP_ENABLED=true with an empty GOOGLE_ALLOWED_DOMAINS: any "
            "verified Google address can create an account and bypass approval."
        )


def log_shared_state_limitations() -> None:
    """Surface the single-instance assumptions instead of failing silently.

    Both the rate limiter and the WebSocket connection registry are process-local,
    so horizontal scaling changes behaviour without any error being raised:
    per-instance limits would multiply, and a broadcast would only reach the
    clients connected to the instance that served the request. Logging the
    assumption at startup turns a silent scaling bug into an explicit one.
    """
    if settings.SLOWAPI_STORAGE_URI == "memory://":
        logger.warning(
            SHARED_STATE_NOTICE.format(
                component="Rate limiting (SLOWAPI_STORAGE_URI=memory://)"
            )
        )
    else:
        logger.info("Rate limiting uses shared storage: %s", settings.SLOWAPI_STORAGE_URI)

    if broadcast_bus.shared:
        logger.info(
            "WebSocket broadcasts fan out across instances via Redis (channel %s)",
            settings.WS_BROADCAST_CHANNEL,
        )
    else:
        logger.warning(SHARED_STATE_NOTICE.format(component="WebSocket notifications"))

    # A warning is easy to miss on a deploy log; when the operator says the
    # process-local defaults are unacceptable, refuse to serve instead.
    if settings.REQUIRE_SHARED_STATE:
        missing = []
        if settings.SLOWAPI_STORAGE_URI == "memory://":
            missing.append("SLOWAPI_STORAGE_URI is memory://")
        if not broadcast_bus.shared:
            missing.append("WS_BROADCAST_REDIS_URL is unset")
        if missing:
            raise RuntimeError(
                "REQUIRE_SHARED_STATE is set but shared state is not configured: "
                + ", ".join(missing)
            )


async def _session_cleanup_loop(interval_hours: int) -> None:
    """Delete expired sessions every ``interval_hours`` until cancelled.

    The first pass runs one interval after startup rather than immediately, so a
    short-lived process (the test suite, a rolling deploy) never touches the
    table. ``python -m app.services.session_cleanup`` remains available for
    deployments that would rather run this from cron.
    """
    while True:
        await asyncio.sleep(interval_hours * 3600)
        try:
            async with SessionLocal() as db:
                await cleanup_expired_sessions_async(db)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Scheduled session cleanup failed: %s", exc)


async def _notification_scheduler_loop(check_interval_seconds: int = 60) -> None:
    """Periodically check and dispatch scheduled notifications (daily briefings, fuel price warning, market summary).

    Every window is claimed in the database before dispatch, so a restart or a
    second instance cannot send the same digest twice.
    """
    from app.services.notification_dispatcher import dispatch_event_notifications
    from app.services.scheduler_state import claim_slot

    while True:
        await asyncio.sleep(check_interval_seconds)
        try:
            bangkok_now = datetime.now(ZoneInfo("Asia/Bangkok"))
            current_hour = bangkok_now.hour
            day = bangkok_now.date().isoformat()
            current_time_hhmm = f"{current_hour:02d}:{bangkok_now.minute:02d}"

            # 1. User-scheduled customizable daily briefings (once per minute).
            #    The service delivers anything due within its catch-up window, so a
            #    minute this loop never reached still delivers the morning push.
            async with SessionLocal() as db:
                if await claim_slot(db, "briefing", f"{day}T{current_time_hhmm}"):
                    from app.services.daily_briefing_service import dispatch_scheduled_briefings
                    await dispatch_scheduled_briefings(db, bangkok_now)

            # 2. Morning broadcast daily digest at 08:00
            if current_hour == 8:
                async with SessionLocal() as db:
                    if await claim_slot(db, "daily_summary", f"{day}T{current_hour:02d}"):
                        await dispatch_event_notifications(
                            db, "daily_summary", "☀️ สรุปภารกิจและรายงานประจำวันพร้อมแล้ว"
                        )

            # 3. Fuel price change early warning, hourly during 17:00–17:59
            #    (covers the 17:00 and 17:30 checks without a second window at 18:00)
            if current_hour == 17:
                async with SessionLocal() as db:
                    if await claim_slot(db, "fuel_warning", f"{day}T{current_hour:02d}"):
                        from app.services.fuel_warning_service import dispatch_fuel_warning_if_changed
                        await dispatch_fuel_warning_if_changed(db)

            # 4. Evening market summary at 17:00
            if current_hour == 17:
                async with SessionLocal() as db:
                    if await claim_slot(db, "market_alert", f"{day}T{current_hour:02d}"):
                        await dispatch_event_notifications(
                            db, "market_alert", "📈 สรุปภาพรวมตลาด SET และค่าเงินหลังปิดตลาด"
                        )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Notification scheduler loop warning: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is owned by Alembic (`alembic upgrade head`). AUTO_CREATE_TABLES is a
    # local-development convenience only; nothing else touches the schema at startup.
    try:
        async with engine.begin() as conn:
            if settings.AUTO_CREATE_TABLES:
                if settings.DEBUG:
                    logger.info("AUTO_CREATE_TABLES=True: creating tables (dev convenience)")
                else:
                    logger.warning(
                        "AUTO_CREATE_TABLES=True in non-DEBUG mode! Prefer Alembic "
                        "migrations in production."
                    )
                await conn.run_sync(base.Base.metadata.create_all)

    except Exception as e:
        logger.warning("Startup schema check failed: %s", e)

    # Resolve the persistent VAPID pair at boot. Waiting for the first
    # /web-push/vapid-key request meant every push right after a deploy used a
    # freshly generated in-memory key and failed with a VAPID mismatch.
    try:
        from app.services.web_push_service import ensure_persistent_vapid_keys

        async with SessionLocal() as db:
            await ensure_persistent_vapid_keys(db)
    except Exception as exc:
        logger.warning("VAPID key initialisation failed: %s", exc)

    # Subscribe to the broadcast fan-out (a no-op unless WS_BROADCAST_REDIS_URL
    # is set), then report which single-instance assumptions still apply.
    await broadcast_bus.start(ws_manager.broadcast)
    log_shared_state_limitations()
    log_email_delivery_configuration()

    cleanup_task: "asyncio.Task[None] | None" = None
    notif_task: "asyncio.Task[None] | None" = None
    if not settings.DEBUG:
        notif_task = asyncio.create_task(_notification_scheduler_loop())
    if settings.SESSION_CLEANUP_INTERVAL_HOURS > 0:
        cleanup_task = asyncio.create_task(
            _session_cleanup_loop(settings.SESSION_CLEANUP_INTERVAL_HOURS)
        )
        logger.info(
            "Session cleanup scheduled every %d h", settings.SESSION_CLEANUP_INTERVAL_HOURS
        )
    else:
        # Legitimate for a cron-based deployment, silent poison for one that
        # just set the variable to 0: expired sessions and dead trusted-device
        # rows then never go away and the security page keeps listing them.
        logger.warning(
            "Session cleanup scheduler disabled (SESSION_CLEANUP_INTERVAL_HOURS=0) — "
            "run `python -m app.services.session_cleanup` on a schedule"
        )

    try:
        yield
    finally:
        if cleanup_task is not None:
            cleanup_task.cancel()
            await asyncio.gather(cleanup_task, return_exceptions=True)
        if notif_task is not None:
            notif_task.cancel()
            await asyncio.gather(notif_task, return_exceptions=True)
        await broadcast_bus.stop()
# CORS is explicit because authenticated cookies must never be shared with
# arbitrary preview deployments. Set CORS_ORIGINS in the production host.
allowed_origins = [origin.rstrip("/") for origin in settings.get_cors_origins() if origin.strip()]


# Interactive docs expose the full API surface, so they stay behind an explicit
# opt-in (ENABLE_API_DOCS) and are on automatically for local DEBUG runs.
_docs_enabled = settings.ENABLE_API_DOCS or settings.DEBUG

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Workspace API - Modern Stack Migration",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore


# Middleware registration order is REVERSED by Starlette: the LAST middleware
# added is the OUTERMOST. CSRF is added first so a rejected request still travels
# back out through CSP (security headers) and CORS (browser-readable 403);
# RequestID is added last so every request — including one CSRF rejects — already
# carries a correlation id.
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
# Outermost: the correlation id exists before any other middleware can reject the
# request, and the header is added on the way out to every response.
app.add_middleware(RequestIDMiddleware)


@app.api_route("/", methods=["GET", "HEAD"], tags=["Root"])
async def root():
    """Root endpoint - Health check.

    HEAD is included because platform deploy probes (Render) send ``HEAD /``
    before they switch to the configured health path; a GET-only route answers
    405 and looks like a failed boot in the logs.
    """
    return {
        "message": "Workspace API",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


# Long enough for a TLS round-trip to a managed Postgres on a small instance,
# short enough that a hung database cannot make the liveness probe itself hang
# (a probe that never answers looks exactly like a crashed process).
HEALTH_DB_TIMEOUT_SECONDS = 5.0


def _format_ping_failure(exc: BaseException) -> str:
    """``TimeoutError`` and some driver errors have an empty ``str()``."""
    detail = str(exc).strip()
    return f"{type(exc).__name__}: {detail}" if detail else type(exc).__name__


async def _ping_database() -> tuple[bool, float | None]:
    """Run ``SELECT 1`` with a timeout; return (ok, latency_ms)."""
    async def _ping() -> None:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.commit()

    started = time.perf_counter()
    try:
        # wait_for (not asyncio.timeout) keeps the 3.10 floor declared in the docs.
        await asyncio.wait_for(_ping(), timeout=HEALTH_DB_TIMEOUT_SECONDS)
    except Exception as exc:
        logger.warning("Health-check database ping failed: %s", _format_ping_failure(exc))
        return False, None
    return True, round((time.perf_counter() - started) * 1000, 2)


@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
async def health_check():
    """Liveness probe: the process is up, and reports whether the database is reachable.

    Always answers ``200`` so an existing uptime monitor keeps working; the
    ``database`` field and ``status`` carry the detail. Use ``/health/ready`` to
    gate traffic: it answers ``503`` when the database is down. This used to be a
    hardcoded `"healthy"` string, so a deployment with an unreachable database
    still reported perfect health.
    """
    db_ok, latency_ms = await _ping_database()
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy" if db_ok else "degraded",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "database": {
                "status": "ok" if db_ok else "down",
                "latency_ms": latency_ms,
            },
        },
    )


@app.api_route("/health/ready", methods=["GET", "HEAD"], tags=["Health"])
async def readiness_check():
    """Readiness probe: ``200`` only when the database answers."""
    db_ok, latency_ms = await _ping_database()
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={
            "status": "ready" if db_ok else "not_ready",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "database": {
                "status": "ok" if db_ok else "down",
                "latency_ms": latency_ms,
            },
        },
    )

# Include API router
app.include_router(api_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8080,
        reload=settings.DEBUG,
    )
