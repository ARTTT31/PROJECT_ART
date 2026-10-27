"""The sync-driver mapping Alembic and the cron cleanup script depend on.

SQLAlchemy 2.1 resolves a bare ``postgresql://`` to psycopg 3, which this
project does not install. Stripping the async driver for "no driver at all"
therefore made every deploy fail at ``alembic upgrade head`` with
``ModuleNotFoundError: No module named 'psycopg'`` while the SQLite-based test
suite stayed green, because it never exercises the Postgres branch.
"""

import pytest

from app.core.database import to_sync_database_url


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
