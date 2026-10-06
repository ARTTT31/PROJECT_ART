# -*- coding: utf-8 -*-
"""
Database-backed (L2) cache for the weather / geocode proxies.

The proxies already keep a per-process L1 dict, but that cache is lost on every
restart, redeploy or scale event. Open-Meteo throttles per IP and the deployment
egress is shared, so the moment an instance starts cold it has nothing to serve
when the provider answers 429. This layer stores the last known good payload in
the existing database, so the stale fallback survives a restart.

It is strictly best-effort: every helper swallows (and logs) database errors so
a database problem degrades the proxy to its previous L1-only behaviour instead
of taking the unauthenticated login-page widget down with it.
"""

import json
import logging
from datetime import timedelta
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.models.weather_cache import WeatherCacheEntry

logger = logging.getLogger(__name__)

# Coordinates come from user input, so the key space is effectively unbounded.
# Rows older than this are pruned opportunistically on write, which bounds the
# table without needing a scheduled job.
MAX_AGE = timedelta(days=7)


def build_key(namespace: str, key: tuple) -> str:
    """Build a stable, human-readable storage key for a cache tuple."""
    return ":".join([namespace, *(str(part) for part in key)])


def _decode(payload: str) -> Optional[dict]:
    try:
        decoded: Any = json.loads(payload)
    except ValueError:
        logger.warning("Discarding undecodable weather cache row")
        return None
    return decoded if isinstance(decoded, dict) else None


async def _load(db: AsyncSession, storage_key: str) -> Optional[WeatherCacheEntry]:
    try:
        result = await db.execute(
            select(WeatherCacheEntry).where(WeatherCacheEntry.key == storage_key)
        )
        return result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("Weather cache read failed (%s); continuing without L2", exc)
        return None


async def get_fresh(
    db: AsyncSession, namespace: str, key: tuple, ttl_seconds: int
) -> Optional[dict]:
    """Return a stored payload that is still within its TTL."""
    row = await _load(db, build_key(namespace, key))
    if row is None:
        return None
    if (utcnow() - row.updated_at).total_seconds() > ttl_seconds:
        return None
    return _decode(row.payload)


async def get_stale(db: AsyncSession, namespace: str, key: tuple) -> Optional[dict]:
    """Return a stored payload regardless of its TTL (last-resort fallback)."""
    row = await _load(db, build_key(namespace, key))
    return _decode(row.payload) if row is not None else None


async def store(db: AsyncSession, namespace: str, key: tuple, data: dict) -> None:
    """Persist a payload, pruning entries that have outlived ``MAX_AGE``.

    Never raises: caching must not be able to fail a user-facing request.
    """
    storage_key = build_key(namespace, key)
    try:
        payload = json.dumps(data, ensure_ascii=False)
    except (TypeError, ValueError) as exc:
        logger.warning("Weather cache payload not serialisable (%s); skipping L2", exc)
        return

    try:
        row = await db.get(WeatherCacheEntry, storage_key)
        if row is None:
            db.add(
                WeatherCacheEntry(key=storage_key, payload=payload, updated_at=utcnow())
            )
        else:
            row.payload = payload
            row.updated_at = utcnow()

        await db.execute(
            delete(WeatherCacheEntry).where(
                WeatherCacheEntry.updated_at < utcnow() - MAX_AGE
            )
        )
        await db.commit()
    except Exception as exc:
        logger.warning("Weather cache write failed (%s); serving from L1 only", exc)
        try:
            await db.rollback()
        except Exception:  # pragma: no cover - rollback of a broken session
            pass
