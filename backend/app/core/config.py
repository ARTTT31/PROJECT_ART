"""
Application Configuration
"""

from typing import List
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
        import os
        if "RENDER" in os.environ:
            return True
        env_val = os.getenv("COOKIE_SECURE")
        if env_val is not None:
            return env_val.lower() in ("true", "1", "yes")
        return not self.DEBUG

    @property
    def COOKIE_SAMESITE(self) -> str:
        import os
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
        "capacitor://localhost"
    )

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from string"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
