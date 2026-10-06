"""
Session Cleanup Service

Deletes expired and long-inactive rows from ``sessions`` so the table does not
grow forever. There are two entry points:

* an async function used by the in-app scheduler
  (``SESSION_CLEANUP_INTERVAL_HOURS``, see ``app.main.lifespan``), and
* a synchronous standalone script for deployments that prefer cron:

      cd backend && python -m app.services.session_cleanup

The sync path exists because it can run without the application event loop —
nothing in this project shells into Docker any more.
"""

import logging
import os
import sys
from datetime import timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, delete
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import UserSession
from app.core.utils import utcnow

logger = logging.getLogger(__name__)

DEFAULT_MAX_AGE_DAYS = 7


def _expired_filter(now, cutoff_date):
    """Rows that are expired, or inactive and untouched past the cutoff."""
    return (UserSession.expires_at < now) | (
        (UserSession.is_active.is_(False)) & (UserSession.updated_at < cutoff_date)
    )


def cleanup_expired_sessions(db: Session, max_age_days: int = DEFAULT_MAX_AGE_DAYS) -> int:
    """
    Remove all sessions that have expired (expires_at < now).
    Also remove sessions older than max_age_days that are marked inactive.

    Args:
        db: SQLAlchemy database session
        max_age_days: Maximum age in days for expired sessions (default: 7)

    Returns:
        Number of deleted session records
    """
    now = utcnow()
    cutoff_date = now - timedelta(days=max_age_days)

    total = (
        db.query(UserSession)
        .filter(_expired_filter(now, cutoff_date))
        .delete(synchronize_session="fetch")
    )
    db.commit()

    if total > 0:
        logger.info("Removed %d expired/inactive sessions", total)
    else:
        logger.debug("No expired sessions found")

    return int(total)


async def cleanup_expired_sessions_async(
    db: AsyncSession, max_age_days: int = DEFAULT_MAX_AGE_DAYS
) -> int:
    """Async twin of :func:`cleanup_expired_sessions` for the in-app scheduler.

    Same two rules, expressed once in ``_expired_filter`` so the script and the
    scheduler cannot drift apart.
    """
    now = utcnow()
    cutoff_date = now - timedelta(days=max_age_days)

    result = await db.execute(delete(UserSession).where(_expired_filter(now, cutoff_date)))
    await db.commit()

    # AsyncSession.execute is typed as returning a generic Result; a DELETE always
    # produces a CursorResult, which is where rowcount lives.
    total = int(cast(CursorResult[Any], result).rowcount or 0)
    if total > 0:
        logger.info("Removed %d expired/inactive sessions", total)
    else:
        logger.debug("No expired sessions found")
    return total


def run_cleanup() -> None:
    """
    Standalone entry point. Connects to the database using
    DATABASE_URL from environment and runs cleanup.
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL environment variable not set")
        sys.exit(1)

    # Settings rewrites the URL for the async driver (``sqlite+aiosqlite://``,
    # ``postgresql+asyncpg://``); this script builds a synchronous engine, so
    # the driver suffix has to come back off.
    database_url = database_url.replace("+aiosqlite", "").replace("+asyncpg", "")

    from sqlalchemy import create_engine

    engine = create_engine(database_url)
    try:
        with Session(engine) as db:
            cleanup_expired_sessions(db)
    finally:
        engine.dispose()


if __name__ == "__main__":
    run_cleanup()
