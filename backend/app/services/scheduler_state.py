# -*- coding: utf-8 -*-
"""Cross-instance claims for periodic jobs.

The notification loop used to dedupe in a process-local dict, so a restart in
the middle of the send window re-sent the digest, and two instances each sent
their own copy. A claim is persisted in ``system_settings`` and taken with a
conditional UPDATE, which is atomic on both SQLite and PostgreSQL.
"""

import logging
from typing import Any, cast

from sqlalchemy import or_, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


def _claim_key(name: str) -> str:
    return f"scheduler:{name}"


async def claim_slot(db: AsyncSession, name: str, slot: str) -> bool:
    """Atomically claim ``slot`` for job ``name``; True when this caller won.

    ``slot`` is a date/time string (e.g. ``2026-11-09T17``), so the same job can
    run again in the next window even though its claim row is reused.
    """
    key = _claim_key(name)
    result = cast(
        CursorResult[Any],
        await db.execute(
            update(SystemSetting)
            .where(
                SystemSetting.key == key,
                or_(SystemSetting.value.is_(None), SystemSetting.value != slot),
            )
            .values(value=slot)
        ),
    )
    if result.rowcount == 1:
        await db.commit()
        return True
    if result.rowcount:
        # Defensive: a multi-row match would mean a duplicate primary key.
        await db.commit()
        return False

    existing = await db.get(SystemSetting, key)
    if existing is not None:
        # Another instance already claimed this slot (or the row holds the
        # same value because we are the duplicate caller).
        await db.rollback()
        return False

    db.add(SystemSetting(key=key, value=slot, description=f"last run of {name}"))
    try:
        await db.commit()
        return True
    except IntegrityError:
        # Both instances saw no row; the conditional UPDATE above cannot help
        # here, so the loser of the INSERT simply skips this window.
        await db.rollback()
        return False
