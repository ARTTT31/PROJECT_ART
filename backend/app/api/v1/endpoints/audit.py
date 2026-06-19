from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.schemas.audit_log import AuditLogResponse
from app.services.audit_service import AuditService
from app.api.dependencies import get_current_admin_user
from app.models.user import User

router = APIRouter()


class PaginatedAuditLogsResponse(BaseModel):
    items: List[AuditLogResponse]
    page: int
    size: int
    total: int
    hasNext: bool
    hasPrev: bool


@router.get("/", response_model=List[AuditLogResponse])
async def list_audit_logs(
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
async def list_audit_logs_paginated(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List audit logs with pagination (Admin only)
    """
    audit_service = AuditService(db)
    skip = (page - 1) * size
    logs = await audit_service.get_logs(
        skip=skip, limit=size + 1
    )  # Get one extra to check hasNext

    has_next = len(logs) > size
    if has_next:
        logs = logs[:size]

    return PaginatedAuditLogsResponse(
        items=logs,
        page=page,
        size=size,
        total=0,  # Set to 0 to avoid PostgreSQL full-table COUNT(*) query bottlenecks
        hasNext=has_next,
        hasPrev=page > 1,
    )
