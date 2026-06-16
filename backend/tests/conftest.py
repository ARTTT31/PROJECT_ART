"""
Pytest configuration and shared fixtures for ART Workspace backend tests.
"""
import os

# Override environment variables before importing app modules
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "7")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
