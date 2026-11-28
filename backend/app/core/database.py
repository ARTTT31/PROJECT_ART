"""
Database Configuration and Session Management
"""

import logging
import os
import ssl
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resolve_ca_cert_file(cert_path: str | None = None) -> Path | None:
    """Return a readable CA certificate file from ``SSL_CA_CERT_PATH`` or ``SSL_CA_CERT``.

    ``SSL_CA_CERT_PATH`` wins when it points to an existing file. When omitted
    (and ``cert_path`` was not explicitly passed), inline PEM content in
    ``SSL_CA_CERT`` is materialized to a temp file so both ``asyncpg`` and
    ``psycopg2``/libpq can verify against it.
    """
    resolved = cert_path if cert_path is not None else getattr(settings, "SSL_CA_CERT_PATH", None)
    if resolved:
        cert_file = Path(resolved.strip())
        if cert_file.is_file():
            return cert_file

    if cert_path is not None:
        return None

    inline_pem = (getattr(settings, "SSL_CA_CERT", "") or "").strip()
    if not inline_pem:
        return None

    normalized_pem = inline_pem.replace("\\n", "\n")
    if not normalized_pem.endswith("\n"):
        normalized_pem += "\n"

    target = Path(tempfile.gettempdir()) / f"workspace-db-ca-{os.getpid()}.pem"
    try:
        if not target.is_file() or target.read_text(encoding="utf-8") != normalized_pem:
            target.write_text(normalized_pem, encoding="utf-8")
            try:
                os.chmod(target, 0o600)
            except OSError:
                pass
    except OSError as exc:
        logger.warning("Failed to materialize SSL_CA_CERT to %s: %s", target, exc)
        return None
    return target


def _build_ssl_context(cert_path: str | None = None) -> ssl.SSLContext | None:
    """Return an SSL context that trusts the configured CA, or None when absent.

    Some managed providers (such as Aiven) require their project CA file;
    others (such as Supabase) use a provider root CA outside the container's
    default trust store. When ``SSL_CA_CERT_PATH`` (or ``SSL_CA_CERT``) provides
    a valid CA we enforce ``CERT_REQUIRED`` against that CA.
    """
    cert_file = _resolve_ca_cert_file(cert_path)
    if cert_file is None:
        return None
    ctx = ssl.create_default_context(
        purpose=ssl.Purpose.SERVER_AUTH,
        cafile=str(cert_file),
    )
    # Aiven's shared project CA does not always carry the service hostname, so
    # hostname matching stays off; the certificate chain is still verified
    # against the provider CA (CERT_REQUIRED), which is the part that prevents a
    # rogue server from impersonating the database.
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_REQUIRED
    return ctx


def _unverified_ssl_context() -> ssl.SSLContext:
    """Encrypted but unauthenticated TLS (the old ``sslmode=require`` fallback)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
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

    if not is_local and "sslmode=disable" in db_url:
        # An explicit disable used to pass silently. In production it makes the
        # database password and every query readable on the network, so it now
        # needs the same deliberate opt-in as an unverified TLS connection.
        if not settings.DEBUG and not settings.ALLOW_INSECURE_DB_TLS:
            raise RuntimeError(
                "DATABASE_URL requests sslmode=disable for a remote PostgreSQL. "
                "Remove it and set SSL_CA_CERT_PATH to the provider CA, or set "
                "ALLOW_INSECURE_DB_TLS=true only for a throwaway environment."
            )
        logger.warning(
            "DATABASE_URL disables PostgreSQL TLS for remote host %s. "
            "Credentials and queries are readable on the network.",
            host or "(unknown)",
        )
        return connect_args

    if not is_local:
        ssl_ctx = _build_ssl_context(cert_path)
        if ssl_ctx is None:
            # TLS without certificate verification is still encryption, but it
            # cannot tell the real database from a man-in-the-middle. It used to
            # be the silent default whenever SSL_CA_CERT_PATH was empty or its
            # file was missing; production now has to opt in explicitly.
            if not settings.DEBUG and not settings.ALLOW_INSECURE_DB_TLS:
                raise RuntimeError(
                    "Refusing to connect to a remote PostgreSQL without a verified "
                    "TLS certificate. Set SSL_CA_CERT_PATH to the provider's CA "
                    "file or SSL_CA_CERT to the PEM content (Supabase: Project "
                    "Settings -> Database -> SSL Configuration), or set "
                    "ALLOW_INSECURE_DB_TLS=true only for a throwaway environment."
                )
            logger.warning(
                "Remote PostgreSQL TLS is encrypted but NOT verified (no usable "
                "SSL_CA_CERT_PATH). Set SSL_CA_CERT_PATH; ALLOW_INSECURE_DB_TLS "
                "only silences this for a throwaway environment."
            )
            ssl_ctx = _unverified_ssl_context()
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


def build_sync_connect_args(db_url: str) -> dict[str, Any]:
    """TLS arguments for the synchronous engine used by Alembic.

    Alembic's ``preDeployCommand`` runs before the app, so it must enforce the
    same rule as the async engine: a provider CA is verified when present, and a
    production deployment without one refuses to connect instead of falling back
    to libpq's ``sslmode=require`` (encrypted, unauthenticated).
    """
    if "sqlite" in db_url:
        return {}

    cert_file = _resolve_ca_cert_file()
    if cert_file is not None:
        return {"sslmode": "verify-ca", "sslrootcert": str(cert_file)}

    if not settings.DEBUG and not settings.ALLOW_INSECURE_DB_TLS:
        raise RuntimeError(
            "Refusing to run migrations over an unverified PostgreSQL connection. "
            "Set SSL_CA_CERT_PATH to the provider's CA file or SSL_CA_CERT to the "
            "PEM content (Supabase: Project Settings -> Database -> SSL "
            "Configuration), or set ALLOW_INSECURE_DB_TLS=true only for a "
            "throwaway environment."
        )
    logger.warning(
        "Alembic is connecting to a remote PostgreSQL with encrypted but "
        "unverified TLS (no usable SSL_CA_CERT_PATH)."
    )
    return {"sslmode": "require"}


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
