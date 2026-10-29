from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request
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
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List audit logs with pagination and optional filters (Admin only).

    ``action`` filters an exact action key, ``q`` searches the details and the
    actor's name/email.
    """
    audit_service = AuditService(db)
    skip = (page - 1) * size
    logs = await audit_service.get_logs(
        skip=skip, limit=size + 1, action=action, q=q
    )
    has_next = len(logs) > size
    if has_next:
        logs = logs[:size]

    total = await audit_service.count_logs(action=action, q=q)

    return PaginatedAuditLogsResponse(
        items=logs,
        page=page,
        size=size,
        total=total,
        hasNext=has_next,
        hasPrev=page > 1,
    )
