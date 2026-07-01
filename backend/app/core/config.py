"""
Application Configuration
"""

import os
from typing import List, Optional
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "ART Workspace API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTO_CREATE_TABLES: bool = False

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

    # CORS — explicit origins required (no wildcards) because allow_credentials=True
    # Added http://localhost and capacitor://localhost for Capacitor Android and iOS applications
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:80,"
        "http://localhost:8000,https://project-art-sigma.vercel.app,"
        "https://art-workspace-api.onrender.com,http://localhost,"
        "capacitor://localhost,"
        "null"  # Android WebViews send Origin: null for capacitor:// / file:// requests
    )

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from string"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS

    # ── Google OAuth ────────────────────────────────────────────────────────
    # These have NO hardcoded defaults. An empty/missing value fails fast at the
    # auth endpoints so we never silently fall back to a real client ID baked
    # into source. Use settings.require_google_*() to validate before use.
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

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
