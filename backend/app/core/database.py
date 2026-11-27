"""
Database Configuration and Session Management
"""

import ssl
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _build_ssl_context(cert_path: str | None = None) -> ssl.SSLContext | None:
    """Return an SSL context that trusts the configured CA, or None when absent.

    Some managed providers (such as Aiven) require their project CA file;
    others (such as Supabase) use a provider root CA outside the container's
    default trust store. When ``SSL_CA_CERT_PATH`` points to a valid file we
    enforce ``CERT_REQUIRED`` against that CA.
    """
    resolved = cert_path if cert_path is not None else getattr(settings, "SSL_CA_CERT_PATH", None)
    if not resolved:
        return None
    cert_file = Path(resolved)
    if not cert_file.is_file():
        return None
    ctx = ssl.create_default_context(
        purpose=ssl.Purpose.SERVER_AUTH,
        cafile=str(cert_file),
    )
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_REQUIRED
    return ctx


def build_async_connect_args(db_url: str, cert_path: str | None = None) -> dict[str, Any]:
    """Build driver-specific ``connect_args`` for ``create_async_engine``.

    - SQLite keeps ``check_same_thread=False`` for async test/dev runs.
    - Remote PostgreSQL defaults to encrypted TLS (``sslmode=require`` semantics,
      matching ``alembic/env.py``) when no ``SSL_CA_CERT_PATH`` file is present,
      because ``asyncpg`` treats ``ssl=True`` as ``verify-full`` against OS CAs
      and rejects provider CAs such as Supabase's ``prod-ca-2021.crt``.
    - Transaction poolers (port ``6543`` / ``pgbouncer=true``) disable
      ``asyncpg``'s prepared-statement cache so multiplexed connections do not
      collide with ``DuplicatePreparedStatementError``.
    """
    if "sqlite" in db_url:
        return {"check_same_thread": False}

    parsed = urlsplit(db_url)
    host = (parsed.hostname or "").lower()
    is_local = host in ("localhost", "127.0.0.1", "::1")
    connect_args: dict[str, Any] = {}

    if not is_local and "sslmode=disable" not in db_url:
        ssl_ctx = _build_ssl_context(cert_path)
        if ssl_ctx is None:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    try:
        port = parsed.port
    except ValueError:
        port = None
    if port == 6543 or "pgbouncer=true" in parsed.query.lower():
        connect_args["statement_cache_size"] = 0

    return connect_args


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""

    pass


# Create database engine
# NOTE: DATABASE_URL is already normalized by Pydantic validator check_db_url in
# config.py (sqlite:// -> sqlite+aiosqlite://, postgres:///postgresql:// ->
# postgresql+asyncpg://).
db_url = settings.DATABASE_URL

engine_kwargs: dict[str, Any] = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}
connect_args = build_async_connect_args(db_url)
if connect_args:
    engine_kwargs["connect_args"] = connect_args
if "sqlite" not in db_url:
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
    (``sqlite+aiosqlite://``, ``postgresql+asyncpg://``) and a raw Aiven/Render
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
