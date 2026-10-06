"""
Persistent cache rows for the public weather / geocode proxies.

Render restarts, redeploys and scale events all wipe the in-process caches —
which is exactly when Open-Meteo's per-IP throttling hurts most, because a cold
instance has nothing to fall back on and returns a 502. Keeping the last known
good payload in the database makes the stale fallback survive a restart.
"""

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.utils import utcnow


class WeatherCacheEntry(Base):
    """One cached upstream response, keyed by namespace + coordinates + options."""

    __tablename__ = "weather_cache"

    # Namespaced key, e.g. "forecast:13.7563:100.5018:2".
    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<WeatherCacheEntry(key='{self.key}', updated_at={self.updated_at})>"
