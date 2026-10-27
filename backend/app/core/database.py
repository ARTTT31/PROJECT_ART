"""
Database Configuration and Session Management
"""

from typing import Any

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""

    pass


# Create database engine
# NOTE: DATABASE_URL is already normalized by Pydantic validator check_db_url in config.py
# (sqlite:// -> sqlite+aiosqlite://, postgres:///postgresql:// -> postgresql+asyncpg://)
db_url = settings.DATABASE_URL

engine_kwargs: dict[str, Any] = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    is_local = "localhost" in db_url or "127.0.0.1" in db_url
    if not is_local and "sslmode=disable" not in db_url:
        engine_kwargs["connect_args"] = {"ssl": True}
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 5

engine = create_async_engine(db_url, **engine_kwargs)

# Create session factory
SessionLocal = async_sessionmaker(
    autocommit=False, autoflush=False, bind=engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    """
    Dependency for getting database session
    Usage: db: AsyncSession = Depends(get_db)
    """
    async with SessionLocal() as db:
        yield db


def to_sync_database_url(url: str) -> str:
    """Return ``url`` in the form a *synchronous* engine accepts.

    ``Settings`` rewrites DATABASE_URL for the async driver
    (``sqlite+aiosqlite://``, ``postgresql+asyncpg://``) and a raw Neon/Render
    DATABASE_URL is a bare ``postgresql://``, so the two synchronous callers
    (Alembic, ``python -m app.services.session_cleanup``) have to choose a
    synchronous driver themselves. SQLAlchemy 2.1 resolves a bare
    ``postgresql://`` to psycopg 3 — which this project does not install — so
    merely stripping the ``+asyncpg`` suffix made every deploy fail at
    ``alembic upgrade head`` with ``ModuleNotFoundError: No module named
    'psycopg'``. Point the URL at the pinned driver instead.
    """
    if "+aiosqlite" in url:
        return url.replace("+aiosqlite", "", 1)
    if "+asyncpg" in url:
        return url.replace("+asyncpg", "+psycopg2", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url
