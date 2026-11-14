"""Notification archive API.

The browser generates or receives notifications, then calls ``/sync`` with what
it showed. Reads page that archive back, so the same account sees the same
history after signing in on another device. Sending is idempotent on
``client_id``; the list is trimmed to the newest ``MAX_PER_USER`` rows.
"""

import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.utils import utc_iso, utcnow
from app.models.notification_log import NotificationLog
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"

MAX_PER_USER = 300
MAX_SYNC_ITEMS = 50


class NotificationItem(BaseModel):
    client_id: str = Field(..., min_length=1, max_length=80)
    type: Literal["holiday", "weather", "oilprice", "system"] = "system"
    level: Literal["info", "warning", "danger"] = "info"
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=2000)
    at: Optional[str] = Field(None, max_length=40)


class NotificationResponse(BaseModel):
    id: int
    client_id: str
    type: str
    level: str
    title: str
    body: str
    at: str
    read: bool


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse] = Field(default_factory=list)
    unread: int = 0


class NotificationSyncRequest(BaseModel):
    items: list[NotificationItem] = Field(default_factory=list, max_length=MAX_SYNC_ITEMS)


def _occurred_at(raw: Optional[str]) -> datetime:
    """Parse the client timestamp; anything unusable becomes "now"."""
    if raw:
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            # Stored naive (UTC) like every other timestamp in this project.
            return (
                parsed.astimezone(timezone.utc).replace(tzinfo=None)
                if parsed.tzinfo
                else parsed
            )
        except ValueError:
            pass
    return utcnow()


def _to_response(row: NotificationLog) -> NotificationResponse:
    return NotificationResponse(
        id=row.id,
        client_id=row.client_id,
        type=row.type,
        level=row.level,
        title=row.title,
        body=row.body,
        at=utc_iso(row.occurred_at or row.created_at) or "",
        read=row.read_at is not None,
    )


async def _trim(db: AsyncSession, user_id: int) -> None:
    """Keep only the newest ``MAX_PER_USER`` rows for this account."""
    total = await db.scalar(
        select(func.count(NotificationLog.id)).where(NotificationLog.user_id == user_id)
    )
    if not total or total <= MAX_PER_USER:
        return
    cutoff = await db.scalar(
        select(NotificationLog.occurred_at)
        .where(NotificationLog.user_id == user_id)
        .order_by(NotificationLog.occurred_at.desc())
        .offset(MAX_PER_USER - 1)
        .limit(1)
    )
    if cutoff is not None:
        await db.execute(
            delete(NotificationLog).where(
                NotificationLog.user_id == user_id,
                NotificationLog.occurred_at < cutoff,
            )
        )


async def _list(db: AsyncSession, user_id: int, limit: int) -> NotificationListResponse:
    rows = (
        (
            await db.execute(
                select(NotificationLog)
                .where(NotificationLog.user_id == user_id)
                .order_by(NotificationLog.occurred_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    unread = await db.scalar(
        select(func.count(NotificationLog.id)).where(
            NotificationLog.user_id == user_id,
            NotificationLog.read_at.is_(None),
        )
    )
    return NotificationListResponse(
        items=[_to_response(row) for row in rows], unread=unread or 0
    )


@router.get("", response_model=NotificationListResponse)
@limiter.limit(_GENERAL_LIMIT)
async def list_notifications(
    request: Request,
    limit: int = Query(200, ge=1, le=MAX_PER_USER),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _list(db, current_user.id, limit)


@router.post("/sync", response_model=NotificationListResponse)
@limiter.limit(_GENERAL_LIMIT)
async def sync_notifications(
    request: Request,
    payload: NotificationSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Insert notifications this account has not stored yet.

    Existing rows are left alone — re-sending the same list must not resurrect a
    notification the user already read, and must not duplicate it.
    """
    if payload.items:
        existing = set(
            (
                await db.execute(
                    select(NotificationLog.client_id).where(
                        NotificationLog.user_id == current_user.id,
                        NotificationLog.client_id.in_(
                            [item.client_id for item in payload.items]
                        ),
                    )
                )
            )
            .scalars()
            .all()
        )
        now = utcnow()
        added = 0
        for item in payload.items:
            if item.client_id in existing:
                continue
            db.add(
                NotificationLog(
                    user_id=current_user.id,
                    client_id=item.client_id,
                    type=item.type,
                    level=item.level,
                    title=item.title,
                    body=item.body,
                    occurred_at=_occurred_at(item.at),
                    created_at=now,
                    updated_at=now,
                )
            )
            added += 1
        if added:
            await db.flush()
            await _trim(db, current_user.id)
            await db.commit()
            logger.debug("synced %s notifications for user %s", added, current_user.id)

    return await _list(db, current_user.id, MAX_PER_USER)


@router.post("/read-all", response_model=NotificationListResponse)
@limiter.limit(_GENERAL_LIMIT)
async def mark_all_read(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = utcnow()
    rows = (
        (
            await db.execute(
                select(NotificationLog).where(
                    NotificationLog.user_id == current_user.id,
                    NotificationLog.read_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        row.read_at = now
    if rows:
        await db.commit()
    return await _list(db, current_user.id, MAX_PER_USER)


@router.delete("", response_model=NotificationListResponse)
@limiter.limit(_GENERAL_LIMIT)
async def clear_notifications(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(NotificationLog).where(NotificationLog.user_id == current_user.id)
    )
    await db.commit()
    return NotificationListResponse(items=[], unread=0)


@router.get("/health")
@limiter.limit(_GENERAL_LIMIT)
async def notifications_health(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Cheap probe used by the history page to tell "empty" from "unreachable"."""
    now = utcnow()
    return {"status": "ok", "today": now.date().isoformat(), "now": now.time().isoformat()}


__all__ = ["router"]
