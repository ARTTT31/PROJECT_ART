"""
Application Configuration
"""

import logging
import os
from typing import List, Literal
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
    RATE_LIMIT_WEATHER_PER_MINUTE: int = 30  # unauthenticated weather geocode proxies
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = 5  # avatar uploads: the heaviest authenticated write

    # ── Trusted proxies ─────────────────────────────────────────────────────
    # Comma-separated IPs / CIDRs whose X-Forwarded-For header may be believed.
    # Empty (the default) trusts only loopback and RFC1918 peers, which is what a
    # platform load balancer looks like from inside the container. Anything that
    # arrives from the public internet is never trusted, so a caller cannot pick
    # its own rate-limit bucket by inventing a header.
    TRUSTED_PROXY_IPS: str = ""

    # ── Soft-deleted accounts ───────────────────────────────────────────────
    # How long a deleted account sits in the trash before it is purged for good.
    # While it is there the admin can restore it from the admin panel; the
    # email/username stay reserved so the account can come back to the same
    # identity. Set to 0 to purge on the next housekeeping pass.
    USER_DELETE_RETENTION_DAYS: int = 30

    # ── Session housekeeping ────────────────────────────────────────────────
    # In-app scheduler that deletes expired/inactive sessions. Set to 0 to turn
    # it off (then run `python -m app.services.session_cleanup` from cron).
    SESSION_CLEANUP_INTERVAL_HOURS: int = 6

    # Audit rows contain actor ids, IP addresses, and sometimes masked emails.
    # Keep a bounded forensic window instead of growing the table forever; set
    # 0 to retain indefinitely (check the PDPA policy before doing that).
    AUDIT_LOG_RETENTION_DAYS: int = 365

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

    # Database SSL — path to the CA certificate for TLS-hosted Postgres backends
    # (Aiven and other managed providers). When set the async engine builds an ssl.SSLContext that
    # trusts this CA instead of relying on the platform certifi bundle, which does
    # not include self-signed provider CAs.
    SSL_CA_CERT_PATH: str = ""

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
        """Parse CORS origins from string.

        Each entry must be an absolute origin (scheme://host[:port]) — no
        paths, wildcards or ``*``. A malformed list raises immediately: with
        ``allow_credentials=True`` a silently misconfigured CORS list would
        either block the production frontend or (``*``) be rejected by Starlette
        at request time, so failing fast at boot is the safer behaviour.
        """
        from urllib.parse import urlsplit

        if isinstance(self.CORS_ORIGINS, str):
            raw_list = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        else:
            raw_list = list(self.CORS_ORIGINS)

        parsed: List[str] = []
        for origin in raw_list:
            if not origin:
                continue
            if origin == "*":
                raise ValueError(
                    "CORS_ORIGINS must not contain '*': credentials-cookies "
                    "cannot be shared with a wildcard origin. List the exact "
                    "frontend origins instead."
                )
            parts = urlsplit(origin)
            if (
                parts.scheme not in ("http", "https")
                or not parts.netloc
                or parts.path not in ("", "/")
                or parts.query
                or parts.fragment
            ):
                raise ValueError(
                    f"CORS_ORIGINS contains an invalid origin: '{origin}'. "
                    "Each entry must be scheme://host[:port] with no path or "
                    "query (e.g. https://app.example.com)."
                )
            parsed.append(origin.rstrip("/"))
        return parsed

    # ── Registration policy ─────────────────────────────────────────────────
    # Who may create an account:
    #   closed   (default) — nobody. POST /auth/register answers 403 and the
    #                        only way in is an admin creating the account.
    #   approval — anyone may ask, but the account stays inactive and
    #              "pending" until an admin approves it.
    #   open     — self-registration creates a working account immediately.
    REGISTRATION_MODE: Literal["closed", "approval", "open"] = "closed"

    @field_validator("REGISTRATION_MODE", mode="before")
    @classmethod
    def normalize_registration_mode(cls, v: object) -> str:
        """Accept "CLOSED"/" Closed " from a hand-edited .env file."""
        return (str(v).strip().lower() if v is not None else "closed") or "closed"

    # ── Google account creation ─────────────────────────────────────────────
    # Whether a FIRST Google sign-in may create an account, independent of
    # REGISTRATION_MODE. The default is CLOSED: Google creation follows
    # REGISTRATION_MODE (approval queues the request, closed refuses). Set it to
    # true only when the deployment intentionally allows Google-driven signups;
    # combine that with GOOGLE_ALLOWED_DOMAINS so a verified Google address from
    # any domain cannot bypass the approval policy. Existing accounts can always
    # sign in with Google in every mode.
    GOOGLE_SIGNUP_ENABLED: bool = False

    # Domains allowed to CREATE an account through Google, comma-separated
    # (e.g. "example.co.th,example.com"). Empty means "no domain restriction"
    # and is only safe for an explicitly open deployment. This value is read at
    # call time in the auth endpoint so a deployment can change it without a
    # code change; the property exists for startup diagnostics and docs.
    @property
    def GOOGLE_ALLOWED_DOMAINS(self) -> str:
        return os.getenv("GOOGLE_ALLOWED_DOMAINS", "").strip()

    # ── Terms / PDPA consent ────────────────────────────────────────────────
    # Version string recorded on an account when it accepts the terms. Bump it
    # when the terms change so a re-consent can be required later.
    TERMS_VERSION: str = "2026-10"

    # ── Transactional email ─────────────────────────────────────────────────
    # console (default): messages are logged + kept in an in-memory outbox — the
    #   safe choice for local work and for deployments with no provider yet. A
    #   production deployment must set smtp/resend: console means no user ever
    #   receives a reset/verification link (and the link is written to logs).
    # smtp: any relay (Brevo, Gmail app password, SES, ...). resend: Resend API.
    EMAIL_BACKEND: Literal["console", "smtp", "resend"] = "console"
    # RFC 5322 From header, e.g. "ART Workspace <no-reply@example.com>".
    EMAIL_FROM: str = "ART Workspace <no-reply@localhost>"
    # SMTP relay, used when EMAIL_BACKEND=smtp.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    # STARTTLS on submit ports (587). Set False for an implicit-TLS relay on 465.
    SMTP_STARTTLS: bool = True
    # Resend backend
    RESEND_API_KEY: str = ""
    # How long the links stay valid.
    PASSWORD_RESET_TOKEN_MINUTES: int = 30
    EMAIL_VERIFY_TOKEN_MINUTES: int = 1440
    # Require a verified email before a password login succeeds. Off by default
    # so a deployment whose email backend is not configured yet cannot lock
    # everyone out; turn it on once delivery works. Google sign-ins are always
    # verified (Google checks the address), so this never affects them.
    REQUIRE_EMAIL_VERIFICATION: bool = False

    @property
    def FRONTEND_BASE_URL(self) -> str:
        """Frontend origin used in email links (no trailing slash)."""
        return (os.getenv("FRONTEND_URL") or self.FRONTEND_URL).rstrip("/")

    # ── Abuse protection ────────────────────────────────────────────────────
    # Cloudflare Turnstile (optional, free). When the secret is set,
    # /auth/register and /auth/forgot-password require a valid turnstile_token.
    TURNSTILE_SECRET_KEY: str = ""
    # Extra domains to refuse at signup, comma-separated. A small built-in list
    # of known disposable-email providers is always applied.
    DISPOSABLE_EMAIL_DOMAINS: str = ""

    # ── Google OAuth ────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # Public origin of the frontend, used for links inside emails (password
    # reset, verification). FRONTEND_URL is the canonical name; the property
    # above also honours the environment variable of the same name.
    FRONTEND_URL: str = "http://localhost:3000"

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
