"""
Application Configuration
"""

import logging
import os
from typing import List
from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "ART Workspace API"
    APP_VERSION: str = "1.0.0"
    # Production must opt in to development behaviour explicitly.
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def check_db_url(cls, v: str) -> str:
        if v:
            if v.startswith("sqlite://"):
                return v.replace("sqlite://", "sqlite+aiosqlite://", 1)
            elif v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTO_CREATE_TABLES: bool = False
    # CSRF protection (double-submit cookie). Disable only for non-browser clients
    # that cannot send the X-CSRF-Token header.
    CSRF_PROTECTION_ENABLED: bool = True
    # Interactive API docs (/docs, /redoc, /openapi.json). Off by default so
    # production deployments do not expose the schema; enabled automatically in DEBUG.
    ENABLE_API_DOCS: bool = False

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info: ValidationInfo) -> str:
        """Reject short or placeholder signing keys outside local development.

        A weak SECRET_KEY lets anyone forge JWTs, so production (DEBUG=False)
        refuses to boot with one. Local development stays permissive.
        """
        value = (v or "").strip()
        if not value:
            raise ValueError("SECRET_KEY must not be empty")
        weak = {
            "secret",
            "secret-key",
            "changeme",
            "change-me",
            "test",
            "dev",
            "your-secret-key",
            "replace_with_a_long_random_secret",
        }
        is_debug = bool(info.data.get("DEBUG", False))
        if not is_debug and (len(value) < 32 or value.lower() in weak):
            raise ValueError(
                "SECRET_KEY must be at least 32 characters and must not be a "
                "placeholder when DEBUG is False. Generate one with:\n"
                '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return value

    # ── WebSocket notifications ─────────────────────────────────────────────
    # The registry is process-local (see README, "Horizontal scaling"). The
    # endpoint now requires authentication, but every signed-in account can still
    # open sockets and the frontend reconnects automatically, so these caps keep
    # one account (or a reconnect loop) from pinning unbounded memory.
    WS_MAX_CONNECTIONS: int = 200
    WS_MAX_CONNECTIONS_PER_USER: int = 3

    # Rate Limiting — SlowAPI backend
    # Memory backend is local-only and resets on restart (ok for single-pod deploys).
    # For multi-pod / production horizontal scaling set to a Redis URI:
    #   SLOWAPI_STORAGE_URI="redis://user:pass@host:port/db"
    # Backwards-compatible default: memory:// (in-process dict)
    SLOWAPI_STORAGE_URI: str = "memory://"
    # Sensible defaults — auth endpoints get stricter limits than general API.
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10  # login / token verify / refresh attempts per IP
    RATE_LIMIT_GENERAL_PER_MINUTE: int = 120  # general profile/oil endpoints per IP

    # ── Trusted proxies ─────────────────────────────────────────────────────
    # Comma-separated IPs / CIDRs whose X-Forwarded-For header may be believed.
    # Empty (the default) trusts only loopback and RFC1918 peers, which is what a
    # platform load balancer looks like from inside the container. Anything that
    # arrives from the public internet is never trusted, so a caller cannot pick
    # its own rate-limit bucket by inventing a header.
    TRUSTED_PROXY_IPS: str = ""

    # ── Session housekeeping ────────────────────────────────────────────────
    # In-app scheduler that deletes expired/inactive sessions. Set to 0 to turn
    # it off (then run `python -m app.services.session_cleanup` from cron).
    SESSION_CLEANUP_INTERVAL_HOURS: int = 6

    # ── Horizontal scaling ─────────────────────────────────────────────────
    # Redis pub/sub channel used to fan WebSocket broadcasts out to every
    # instance. Empty (the default) keeps broadcasts process-local, which is
    # correct for the current single-instance deployment.
    WS_BROADCAST_REDIS_URL: str = ""
    WS_BROADCAST_CHANNEL: str = "art:ws:notifications"

    # Error Monitoring — Sentry (optional, disabled if DSN is empty)
    # Get a DSN from https://sentry.io/ or your self-hosted Sentry instance.
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1  # 10% of requests get APM traces
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.0  # disabled by default (high overhead)
    SENTRY_ENVIRONMENT: str = "development"  # set via ENV to "production" in prod

    @property
    def COOKIE_SECURE(self) -> bool:
        if "RENDER" in os.environ:
            return True
        env_val = os.getenv("COOKIE_SECURE")
        if env_val is not None:
            return env_val.lower() in ("true", "1", "yes")
        return not self.DEBUG

    @property
    def COOKIE_SAMESITE(self) -> str:
        if "RENDER" in os.environ:
            return "none"
        env_val = os.getenv("COOKIE_SAMESITE")
        if env_val is not None:
            return env_val.lower()
        return "none" if not self.DEBUG else "lax"

    @property
    def COOKIE_SAMESITE_EFFECTIVE(self) -> str:
        """SameSite value that browsers will actually accept.

        `SameSite=None` is only valid together with `Secure`; over plain HTTP the
        browser silently drops the cookie, which looks exactly like "login did not
        persist". Copying production values (``none``) into a local, non-HTTPS
        environment is a common way to hit this, so the value is downgraded to
        ``lax`` — which is correct for same-site local development — and logged
        instead of failing silently.
        """
        if self.COOKIE_SAMESITE == "none" and not self.COOKIE_SECURE:
            logger.warning(
                "COOKIE_SAMESITE=None requires a Secure (HTTPS) cookie; falling "
                "back to 'lax' for this non-HTTPS environment. Set "
                "COOKIE_SAMESITE=lax locally to silence this notice."
            )
            return "lax"
        return self.COOKIE_SAMESITE

    # CORS — explicit origins required (no wildcards) because allow_credentials=True
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from string"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS

    # ── Google OAuth ────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    def require_google_client_id(self) -> str:
        """Return the configured Google client ID or raise a clear 500 error."""
        val = (self.GOOGLE_CLIENT_ID or os.getenv("BACKEND_GOOGLE_CLIENT_ID") or "").strip()
        if not val:
            raise RuntimeError(
                "Google Client ID is not configured. Set GOOGLE_CLIENT_ID "
                "(or BACKEND_GOOGLE_CLIENT_ID) in the environment."
            )
        return val

    def require_google_client_secret(self) -> str:
        """Return the configured Google client secret or raise a clear 500 error."""
        val = (
            self.GOOGLE_CLIENT_SECRET or os.getenv("BACKEND_GOOGLE_CLIENT_SECRET") or ""
        ).strip()
        if not val:
            raise RuntimeError(
                "Google Client Secret is not configured. Set GOOGLE_CLIENT_SECRET "
                "(or BACKEND_GOOGLE_CLIENT_SECRET) in the environment."
            )
        return val

    def get_google_redirect_uri(self) -> str:
        """Return the configured Google redirect URI or a sensible default."""
        return (
            self.GOOGLE_REDIRECT_URI
            or os.getenv("BACKEND_GOOGLE_REDIRECT")
            or "http://localhost:8000/api/v1/auth/google/callback"
        )

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()  # type: ignore[call-arg]
