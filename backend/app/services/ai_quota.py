# -*- coding: utf-8 -*-
"""Per-account daily AI message budget.

``/ai/chat`` is rate limited per IP, which does nothing for a deployment key: one
account behind a shared NAT (or a rotating address) can spend the owner's credits
all day. This module reserves one message from the account's UTC-day budget
before every paid model call. The built-in intent engine costs nothing and is
never counted.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_usage import AiUsage

logger = logging.getLogger(__name__)


def current_day() -> str:
    """UTC calendar day (YYYY-MM-DD).

    UTC rather than the account's timezone: travelling should not hand anyone a
    second budget, and the reset is then the same instant for every client.
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def claim_daily_request(
    db: AsyncSession, user_id: int, limit: int
) -> tuple[bool, int]:
    """Reserve one message from today's budget.

    Returns ``(allowed, used)``. ``limit <= 0`` disables the budget. The row is
    locked for the update so two parallel requests cannot both take the last slot.
    """
    if limit <= 0:
        return True, 0

    day = current_day()
    usage = (
        await db.execute(
            select(AiUsage)
            .where(AiUsage.user_id == user_id, AiUsage.day == day)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if usage is None:
        usage = AiUsage(user_id=user_id, day=day, requests=1)
        db.add(usage)
        try:
            await db.commit()
        except IntegrityError:
            # Another tab created today's row between the SELECT and the INSERT.
            await db.rollback()
            usage = (
                await db.execute(
                    select(AiUsage)
                    .where(AiUsage.user_id == user_id, AiUsage.day == day)
                    .with_for_update()
                )
            ).scalar_one()
            if usage.requests >= limit:
                await db.commit()
                return False, usage.requests
            usage.requests += 1
            await db.commit()
            return True, usage.requests

        return 1 <= limit, 1

    if usage.requests >= limit:
        await db.commit()
        return False, usage.requests

    usage.requests += 1
    await db.commit()
    return True, usage.requests
