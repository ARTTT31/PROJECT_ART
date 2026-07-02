"""
Application Configuration
"""

import os
from typing import List
from pydantic import ConfigDict, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "ART Workspace API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def check_db_url(cls, v: str) -> str:
        if v and v.startswith("sqlite://"):
            return v.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return v

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

    # ── Microsoft Entra ID & SharePoint ──────────────────────────────────────
    MICROSOFT_TENANT_ID: str = ""
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_REDIRECT_URI: str = ""
    SHAREPOINT_LIST_URL: str = "https://absscoth-my.sharepoint.com/personal/pornchai_abss_co_th/Lists/Technical%20Support%20and%20IMACD%20Booking%20Schedule/AllItems.aspx"
    SHAREPOINT_SITE_ID: str = ""
    SHAREPOINT_LIST_ID: str = ""

    def require_microsoft_tenant_id(self) -> str:
        """Return the configured Microsoft Tenant ID or raise a 500 error."""
        val = (self.MICROSOFT_TENANT_ID or os.getenv("BACKEND_MICROSOFT_TENANT_ID") or "").strip()
        if not val:
            raise RuntimeError(
                "Microsoft Tenant ID is not configured. Set MICROSOFT_TENANT_ID "
                "(or BACKEND_MICROSOFT_TENANT_ID) in the environment."
            )
        return val

    def require_microsoft_client_id(self) -> str:
        """Return the configured Microsoft client ID or raise a 500 error."""
        val = (self.MICROSOFT_CLIENT_ID or os.getenv("BACKEND_MICROSOFT_CLIENT_ID") or "").strip()
        if not val:
            raise RuntimeError(
                "Microsoft Client ID is not configured. Set MICROSOFT_CLIENT_ID "
                "(or BACKEND_MICROSOFT_CLIENT_ID) in the environment."
            )
        return val

    def require_microsoft_client_secret(self) -> str:
        """Return the configured Microsoft client secret or raise a 500 error."""
        val = (
            self.MICROSOFT_CLIENT_SECRET or os.getenv("BACKEND_MICROSOFT_CLIENT_SECRET") or ""
        ).strip()
        if not val:
            raise RuntimeError(
                "Microsoft Client Secret is not configured. Set MICROSOFT_CLIENT_SECRET "
                "(or BACKEND_MICROSOFT_CLIENT_SECRET) in the environment."
            )
        return val

    def get_microsoft_redirect_uri(self) -> str:
        """Return the configured Microsoft redirect URI or a sensible default."""
        return (
            self.MICROSOFT_REDIRECT_URI
            or os.getenv("BACKEND_MICROSOFT_REDIRECT")
            or "http://localhost:8000/api/v1/auth/microsoft/callback"
        )

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
