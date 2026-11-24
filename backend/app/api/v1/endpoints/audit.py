from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
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
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List audit logs with pagination and optional filters (Admin only).

    ``action`` filters an exact action key, ``q`` searches the details and the
    actor's name/email, and ``dateFrom``/``dateTo`` bound the calendar days
    (inclusive).
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

    return PaginatedAuditLogsResponse(
        items=logs,
        page=page,
        size=size,
        total=total,
        hasNext=has_next,
        hasPrev=page > 1,
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

    return AuditLogExportResponse(
        items=logs,
        total=total,
        exported=len(logs),
        truncated=truncated,
    )
