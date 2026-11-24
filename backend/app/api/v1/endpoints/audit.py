from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import get_real_client_ip, limiter
from app.core.utils import utcnow
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.services.audit_service import AuditService
from app.api.dependencies import get_current_admin_user
from app.models.user import User

router = APIRouter()

# SlowAPI "limit" strings are static decorator values, built once at import.
# Both endpoints are admin page loads / pagination clicks — user-paced.
_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"


class PaginatedAuditLogsResponse(BaseModel):
    items: List[AuditLogResponse]
    page: int
    size: int
    total: int
    hasNext: bool
    hasPrev: bool
    # Set only when the request named an `anchor`: the page that row sits on,
    # or None when the active filters exclude it.
    anchorPage: Optional[int] = None


class AuditLogExportResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    exported: int
    truncated: bool


# The export is one query per request and its file is kept as evidence, so it
# gets a ceiling far above the page's 100 rows instead of paging. Hitting it is
# reported to the client (``truncated``) rather than silently shortening a file
# an admin would trust.
EXPORT_LIMIT = 5000

# Reading the log is itself an action worth recording: the file and the table
# hold names, addresses and devices, and "who looked at this" is a question an
# investigation asks. But ``/paginated`` fires on every filter keystroke, page
# click and anchor follow, so a visit is one row per (admin, filter set) inside
# this window instead of forty.
VIEW_DEDUPE_MINUTES = 10
VIEW_PREFIX = "เปิดดูบันทึกกิจกรรม"
EXPORT_PREFIX = "ส่งออกบันทึกกิจกรรม CSV"


def _filter_summary(
    action: Optional[str],
    q: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
) -> str:
    """The filters in words, so the recorded row says what was looked at.

    Deterministic for a given filter set: the view dedupe compares this prefix
    against the last rows, and the row itself is read by a person later.
    """
    parts = [f"ประเภท: {action}" if action else "ประเภท: ทั้งหมด"]
    term = (q or "").strip()
    if term:
        parts.append(f'ค้นหา: "{term}"')
    if date_from and date_to:
        parts.append(f"วันที่: {date_from.isoformat()} ถึง {date_to.isoformat()}")
    elif date_from:
        parts.append(f"วันที่: ตั้งแต่ {date_from.isoformat()}")
    elif date_to:
        parts.append(f"วันที่: ถึง {date_to.isoformat()}")
    return " · ".join(parts)


async def _record_view(
    db: AsyncSession,
    current_user: User,
    request: Request,
    summary: str,
    total: int,
) -> None:
    """Record that this admin opened the log under these filters, once.

    The dedupe looks at this admin's own recent view rows and compares the
    *filter* prefix only: the matched total moves as rows are written, and a
    different count must not turn one visit into a stream of rows.
    """
    prefix = f"{VIEW_PREFIX} · {summary}"
    cutoff = utcnow() - timedelta(minutes=VIEW_DEDUPE_MINUTES)
    recent = await db.execute(
        select(AuditLog.details)
        .where(
            AuditLog.action == "AUDIT_LOG_VIEWED",
            AuditLog.user_id == current_user.id,
            AuditLog.created_at >= cutoff,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(20)
    )
    if any((details or "").startswith(prefix) for details in recent.scalars()):
        return

    await AuditService(db).log_action(
        action="AUDIT_LOG_VIEWED",
        user_id=current_user.id,
        details=f"{prefix} · {total} รายการ",
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()


@router.get("/", response_model=List[AuditLogResponse])
@limiter.limit(_GENERAL_LIMIT)
async def list_audit_logs(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all audit logs (Admin only)
    """
    audit_service = AuditService(db)
    logs = await audit_service.get_logs(skip=skip, limit=limit)
    return logs


@router.get("/paginated", response_model=PaginatedAuditLogsResponse)
@limiter.limit(_GENERAL_LIMIT)
async def list_audit_logs_paginated(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None, max_length=100),
    q: Optional[str] = Query(None, max_length=100),
    date_from: Optional[date] = Query(None, alias="dateFrom"),
    date_to: Optional[date] = Query(None, alias="dateTo"),
    anchor: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List audit logs with pagination and optional filters (Admin only).

    ``action`` filters an exact action key, ``q`` searches the details and the
    actor's name/email, and ``dateFrom``/``dateTo`` bound the calendar days
    (inclusive). ``anchor`` names one log id and adds ``anchorPage``: the page
    it is on under these filters, so a shared row link can open the right page.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด",
        )

    audit_service = AuditService(db)
    skip = (page - 1) * size
    logs = await audit_service.get_logs(
        skip=skip,
        limit=size + 1,
        action=action,
        q=q,
        date_from=date_from,
        date_to=date_to,
    )
    has_next = len(logs) > size
    if has_next:
        logs = logs[:size]

    total = await audit_service.count_logs(
        action=action, q=q, date_from=date_from, date_to=date_to
    )

    anchor_page = None
    if anchor is not None:
        anchor_page = await audit_service.find_page(
            anchor,
            size,
            action=action,
            q=q,
            date_from=date_from,
            date_to=date_to,
        )

    # Last, so the recorded count is the list this admin is about to see (and so
    # a visit cannot change the page it is measuring).
    await _record_view(
        db,
        current_user,
        request,
        _filter_summary(action, q, date_from, date_to),
        total,
    )

    return PaginatedAuditLogsResponse(
        items=logs,
        page=page,
        size=size,
        total=total,
        hasNext=has_next,
        hasPrev=page > 1,
        anchorPage=anchor_page,
    )


@router.get("/export", response_model=AuditLogExportResponse)
@limiter.limit(_GENERAL_LIMIT)
async def export_audit_logs(
    request: Request,
    action: Optional[str] = Query(None, max_length=100),
    q: Optional[str] = Query(None, max_length=100),
    date_from: Optional[date] = Query(None, alias="dateFrom"),
    date_to: Optional[date] = Query(None, alias="dateTo"),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Return every row matching the filters, for the CSV download (Admin only).

    Same filters as ``/paginated``, no page: the page's 20 rows are a view, while
    the file an admin keeps has to be the whole filtered set. ``total`` is the
    count the filters match, ``exported`` is how many rows are in this response,
    and ``truncated`` says the two differ because ``EXPORT_LIMIT`` was reached.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด",
        )

    audit_service = AuditService(db)
    logs = await audit_service.get_logs(
        skip=0,
        limit=EXPORT_LIMIT + 1,
        action=action,
        q=q,
        date_from=date_from,
        date_to=date_to,
    )
    truncated = len(logs) > EXPORT_LIMIT
    if truncated:
        logs = logs[:EXPORT_LIMIT]

    total = await audit_service.count_logs(
        action=action, q=q, date_from=date_from, date_to=date_to
    )

    # Every export is its own row: a file left the app, and the same filters
    # exported twice are two files. It records what the file actually holds,
    # including a cap that cut the export short.
    truncated_note = " · ถึงเพดานการส่งออก" if truncated else ""
    await audit_service.log_action(
        action="AUDIT_LOG_EXPORTED",
        user_id=current_user.id,
        details=(
            f"{EXPORT_PREFIX} · {_filter_summary(action, q, date_from, date_to)}"
            f" · ส่งออก {len(logs)} จาก {total} รายการ{truncated_note}"
        ),
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return AuditLogExportResponse(
        items=logs,
        total=total,
        exported=len(logs),
        truncated=truncated,
    )
