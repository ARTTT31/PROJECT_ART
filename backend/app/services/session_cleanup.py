"""
Session Cleanup Service

Provides a mechanism to clean up expired/inactive sessions from the database.
Can be run as a standalone script or called from a scheduled job.

Usage:
    python -m app.services.session_cleanup          (via docker exec)
    docker-compose exec backend python -m app.services.session_cleanup
"""
import os
import sys
from datetime import datetime, timedelta, timezone

# Add parent directory to path for standalone execution
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.base import Base
from app.models.session import UserSession


def _utcnow() -> datetime:
    """Return current UTC time without tzinfo (for SQLAlchemy DateTime fields)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def cleanup_expired_sessions(db: Session, max_age_days: int = 7) -> int:
    """
    Remove all sessions that have expired (expires_at < now).
    Also remove sessions older than max_age_days that are marked inactive.

    Args:
        db: SQLAlchemy database session
        max_age_days: Maximum age in days for expired sessions (default: 7)

    Returns:
        Number of deleted session records
    """
    now = _utcnow()
    cutoff_date = now - timedelta(days=max_age_days)

    # Delete expired sessions (those past their expires_at)
    expired = (
        db.query(UserSession)
        .filter(UserSession.expires_at < now)
        .delete(synchronize_session="fetch")
    )

    # Delete inactive sessions older than max_age_days
    stale_inactive = (
        db.query(UserSession)
        .filter(
            UserSession.is_active == False,
            UserSession.updated_at < cutoff_date,
        )
        .delete(synchronize_session="fetch")
    )

    db.commit()
    total = expired + stale_inactive

    if total > 0:
        print(f"[SessionCleanup] Removed {expired} expired + {stale_inactive} stale "
              f"inactive sessions (total: {total})")
    else:
        print("[SessionCleanup] No expired sessions found")

    return total


def run_cleanup():
    """
    Standalone entry point. Connects to the database using
    DATABASE_URL from environment and runs cleanup.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    engine = create_engine(database_url)
    try:
        with Session(engine) as db:
            cleanup_expired_sessions(db)
    finally:
        engine.dispose()


if __name__ == "__main__":
    run_cleanup()