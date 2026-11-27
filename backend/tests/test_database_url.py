"""The sync-driver mapping Alembic and the cron cleanup script depend on.

SQLAlchemy 2.1 resolves a bare ``postgresql://`` to psycopg 3, which this
project does not install. Stripping the async driver for "no driver at all"
therefore made every deploy fail at ``alembic upgrade head`` with
``ModuleNotFoundError: No module named 'psycopg'`` while the SQLite-based test
suite stayed green, because it never exercises the Postgres branch.
"""

import ssl
from pathlib import Path

import certifi
import pytest

from app.core.database import build_async_connect_args, to_sync_database_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        # The async forms Settings hands to the callers.
        ("postgresql+asyncpg://u:p@host/db", "postgresql+psycopg2://u:p@host/db"),
        ("sqlite+aiosqlite:///./app.db", "sqlite:///./app.db"),
        # The raw forms an operator sets in the environment (Neon/Render).
        (
            "postgresql://u:p@host/db?sslmode=require",
            "postgresql+psycopg2://u:p@host/db?sslmode=require",
        ),
        ("postgres://u:p@host/db", "postgresql+psycopg2://u:p@host/db"),
        # Already synchronous — leave untouched.
        ("postgresql+psycopg2://u:p@host/db", "postgresql+psycopg2://u:p@host/db"),
        ("sqlite:///:memory:", "sqlite:///:memory:"),
    ],
)
def test_to_sync_database_url(given: str, expected: str) -> None:
    assert to_sync_database_url(given) == expected


def test_remote_postgres_without_ca_uses_tls_without_verify_full() -> None:
    """Match Alembic's ``sslmode=require`` so provider CAs (e.g. Supabase) connect."""
    args = build_async_connect_args(
        "postgresql+asyncpg://postgres.ref:pw@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
        cert_path="",
    )

    ctx = args["ssl"]
    assert isinstance(ctx, ssl.SSLContext)
    assert ctx.verify_mode == ssl.CERT_NONE
    assert "statement_cache_size" not in args


def test_remote_postgres_with_ca_file_enforces_cert_required(tmp_path) -> None:
    ca_file = tmp_path / "ca.pem"
    ca_file.write_text(Path(certifi.where()).read_text(encoding="utf-8"), encoding="utf-8")
    args = build_async_connect_args(
        "postgresql+asyncpg://u:p@db.example.com:5432/app",
        cert_path=str(ca_file),
    )

    ctx = args["ssl"]
    assert isinstance(ctx, ssl.SSLContext)
    assert ctx.verify_mode == ssl.CERT_REQUIRED


def test_missing_ca_file_falls_back_to_encrypted_tls() -> None:
    args = build_async_connect_args(
        "postgresql+asyncpg://u:p@db.example.com:5432/app",
        cert_path="/nonexistent/ca.pem",
    )

    ctx = args["ssl"]
    assert isinstance(ctx, ssl.SSLContext)
    assert ctx.verify_mode == ssl.CERT_NONE


def test_transaction_pooler_port_and_pgbouncer_disable_statement_cache() -> None:
    for url in (
        "postgresql+asyncpg://postgres.ref:pw@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres",
        "postgresql+asyncpg://postgres.ref:pw@pooler.example.com:5432/postgres?pgbouncer=true",
    ):
        args = build_async_connect_args(url, cert_path="")
        assert args["statement_cache_size"] == 0
        assert isinstance(args["ssl"], ssl.SSLContext)


def test_local_and_sqlite_and_disabled_ssl_connect_args() -> None:
    assert build_async_connect_args("sqlite+aiosqlite:///./app.db") == {"check_same_thread": False}
    assert build_async_connect_args("postgresql+asyncpg://u:p@localhost:5432/db") == {}
    assert (
        build_async_connect_args("postgresql+asyncpg://u:p@db.example.com:5432/db?sslmode=disable")
        == {}
    )
