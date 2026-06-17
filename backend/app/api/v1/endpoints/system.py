"""
System Health API - Admin only
"""
import time
import os
import psutil
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text

from app.core.database import get_db
from app.api.dependencies import get_current_admin_user
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

START_TIME = time.time()


class ServiceStatus(BaseModel):
    status: str  # "ok" | "degraded" | "down"
    latency_ms: Optional[float] = None
    detail: Optional[str] = None


class SystemHealth(BaseModel):
    uptime_seconds: float
    database: ServiceStatus
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float


@router.get("/health", response_model=SystemHealth)
async def get_system_health(
    _current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    # Database ping
    db_status = ServiceStatus(status="ok")
    try:
        t0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        db_status.latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    except Exception as e:
        db_status = ServiceStatus(status="down", detail=str(e))

    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return SystemHealth(
        uptime_seconds=round(time.time() - START_TIME, 1),
        database=db_status,
        cpu_percent=psutil.cpu_percent(interval=0.1),
        memory_percent=mem.percent,
        memory_used_mb=round(mem.used / 1024 / 1024, 1),
        memory_total_mb=round(mem.total / 1024 / 1024, 1),
        disk_percent=disk.percent,
    )
