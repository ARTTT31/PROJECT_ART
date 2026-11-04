"""Planner API: the company holiday calendar and each account's own reminders.

Two surfaces that belong together because the dashboard shows them side by side:

- ``/planner/holidays`` — the workspace calendar HR publishes. Admins import the
  PDF, the extracted dates come back as a *draft*, and only the reviewed list is
  saved. Everyone signed in can read it.
- ``/planner/reminders`` — personal entries (ธุระ, ลาหยุด, อื่น ๆ) stored in the
  same JSON-as-text column pattern as quick notes and the watchlist.

The holiday list lives in ``system_settings`` (it is workspace-wide config);
reminders live on the user row (they are private to one account).
"""

import logging
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_admin_user, get_current_user
from app.core.company_holidays import (
    MAX_HOLIDAYS_PER_YEAR,
    MAX_PDF_BYTES,
    MAX_TITLE_LENGTH,
    SETTING_KEY,
    extract_pdf_text,
    parse_company_calendar,
    parse_holiday_candidates,
    serialize_company_calendar,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.personal_reminders import (
    MAX_NOTE,
    MAX_REMINDERS,
    parse_personal_reminders,
    serialize_personal_reminders,
)
from app.core.rate_limit import get_real_client_ip, limiter
from app.core.utils import utcnow
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.audit_service import AuditService

router = APIRouter()
logger = logging.getLogger(__name__)

_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"
_UPLOAD_LIMIT = f"{settings.RATE_LIMIT_UPLOAD_PER_MINUTE}/minute"


# ── Company holiday calendar ─────────────────────────────────────────────────


class CompanyHolidayItem(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    title: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)
    description: Optional[str] = Field(None, max_length=300)

    @field_validator("date")
    @classmethod
    def validate_calendar_date(cls, value: str) -> str:
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date must be a real calendar day") from exc
        return value


class CompanyCalendarResponse(BaseModel):
    years: dict[int, list[CompanyHolidayItem]] = Field(default_factory=dict)
    updated_at: Optional[str] = None


class CalendarYearUpdate(BaseModel):
    year: int = Field(..., ge=2000, le=2200)
    items: list[CompanyHolidayItem] = Field(
        default_factory=list, max_length=MAX_HOLIDAYS_PER_YEAR
    )


class HolidayImportResponse(BaseModel):
    year: Optional[int] = None
    items: list[CompanyHolidayItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    text_length: int = 0


async def _read_calendar(db: AsyncSession) -> tuple[SystemSetting | None, dict[int, list[dict]]]:
    setting = await db.get(SystemSetting, SETTING_KEY)
    return setting, parse_company_calendar(setting.value if setting else None)


@router.get("/holidays", response_model=CompanyCalendarResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_company_calendar(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The workspace holiday calendar, every imported year."""
    setting, calendar = await _read_calendar(db)
    return CompanyCalendarResponse(
        years={
            year: [CompanyHolidayItem(**item) for item in items]
            for year, items in calendar.items()
        },
        updated_at=setting.updated_at.isoformat() if setting and setting.updated_at else None,
    )


@router.post("/holidays/import", response_model=HolidayImportResponse)
@limiter.limit(_UPLOAD_LIMIT)
async def import_company_holidays(
    request: Request,
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Read a holiday PDF into a draft list. Nothing is saved here.

    The admin edits and confirms the draft through ``PUT /planner/holidays``;
    extraction is best-effort, so a preview keeps a bad parse from silently
    replacing a good calendar.
    """
    name = (file.filename or "").lower()
    if not name.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์ PDF ของปฏิทินวันหยุด",
        )

    # Bounded read: one byte past the cap rejects an oversized file without
    # pulling the whole body into memory first.
    contents = await file.read(MAX_PDF_BYTES + 1)
    if len(contents) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ PDF ต้องมีขนาดไม่เกิน 5MB",
        )
    if not contents.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์นี้ไม่ใช่ PDF ที่ถูกต้อง",
        )

    try:
        text = extract_pdf_text(contents)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    items, warnings = parse_holiday_candidates(text)
    if not items:
        warnings.append(
            "ไม่พบวันที่ในไฟล์ ถ้าเป็น PDF ที่สแกนเป็นรูปภาพ ให้เพิ่มวันหยุดเองในตารางด้านล่าง"
        )

    # The most common year wins: a calendar is a single-year document.
    years = [int(item["date"][:4]) for item in items]
    year = max(set(years), key=years.count) if years else None
    if year is not None:
        items = [item for item in items if item["date"].startswith(f"{year}-")]

    logger.info(
        "holiday PDF import: %s page text %s chars, %s dates, admin %s",
        file.filename,
        len(text),
        len(items),
        current_admin.id,
    )
    return HolidayImportResponse(
        year=year,
        items=[CompanyHolidayItem(**item) for item in items],
        warnings=warnings,
        text_length=len(text),
    )


@router.put("/holidays", response_model=CompanyCalendarResponse)
@limiter.limit(_GENERAL_LIMIT)
async def save_company_calendar_year(
    request: Request,
    payload: CalendarYearUpdate,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace one year of the workspace calendar with the confirmed list."""
    for item in payload.items:
        if not item.date.startswith(f"{payload.year}-"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"วันที่ {item.date} ไม่อยู่ในปี {payload.year}",
            )

    setting, calendar = await _read_calendar(db)
    calendar[payload.year] = [item.model_dump() for item in payload.items]
    stored = serialize_company_calendar(calendar)

    current_time = utcnow()
    if setting:
        setting.value = stored
        setting.updated_at = current_time
    else:
        db.add(
            SystemSetting(
                key=SETTING_KEY,
                value=stored,
                description="ปฏิทินวันหยุดบริษัทที่แอดมินนำเข้า",
                created_at=current_time,
                updated_at=current_time,
            )
        )

    await AuditService(db).log_action(
        action="UPDATE_COMPANY_HOLIDAYS",
        user_id=current_admin.id,
        details=f"บันทึกปฏิทินวันหยุดปี {payload.year} จำนวน {len(payload.items)} วัน",
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    _, refreshed = await _read_calendar(db)
    return CompanyCalendarResponse(
        years={
            year: [CompanyHolidayItem(**item) for item in items]
            for year, items in refreshed.items()
        },
        updated_at=current_time.isoformat(),
    )


@router.delete("/holidays/{year}", response_model=CompanyCalendarResponse)
@limiter.limit(_GENERAL_LIMIT)
async def delete_company_calendar_year(
    year: int,
    request: Request,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Drop one year so the widget falls back to the public holiday list."""
    setting, calendar = await _read_calendar(db)
    if setting is None or year not in calendar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ไม่พบปฏิทินวันหยุดปี {year}",
        )

    calendar.pop(year, None)
    current_time = utcnow()
    setting.value = serialize_company_calendar(calendar)
    setting.updated_at = current_time

    await AuditService(db).log_action(
        action="DELETE_COMPANY_HOLIDAYS",
        user_id=current_admin.id,
        details=f"ลบปฏิทินวันหยุดปี {year}",
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return CompanyCalendarResponse(
        years={
            key: [CompanyHolidayItem(**item) for item in items]
            for key, items in calendar.items()
        },
        updated_at=current_time.isoformat(),
    )


# ── Personal reminders ───────────────────────────────────────────────────────


class ReminderItem(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    title: str = Field(..., min_length=1, max_length=MAX_TITLE_LENGTH)
    kind: Literal["errand", "leave", "other"] = "errand"
    note: Optional[str] = Field(None, max_length=MAX_NOTE)
    done: bool = False

    @field_validator("date")
    @classmethod
    def validate_calendar_date(cls, value: str) -> str:
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date must be a real calendar day") from exc
        return value


class RemindersUpdate(BaseModel):
    reminders: list[ReminderItem] = Field(default_factory=list, max_length=MAX_REMINDERS)


class RemindersResponse(BaseModel):
    reminders: list[ReminderItem] = Field(default_factory=list)


async def _stored_reminders(db: AsyncSession, user_id: int) -> str | None:
    """Re-select the column on purpose: it is deferred on auth lookups."""
    result = await db.execute(select(User.personal_reminders).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.get("/reminders", response_model=RemindersResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_reminders(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw = await _stored_reminders(db, current_user.id)
    return RemindersResponse(
        reminders=[ReminderItem(**item) for item in parse_personal_reminders(raw)]
    )


@router.put("/reminders", response_model=RemindersResponse)
@limiter.limit(_GENERAL_LIMIT)
async def save_reminders(
    request: Request,
    payload: RemindersUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace this account's reminder list; last write wins."""
    stored = serialize_personal_reminders(payload.reminders)
    user = await db.get(User, current_user.id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบบัญชีผู้ใช้นี้"
        )
    user.personal_reminders = stored
    await db.commit()
    # Commit expires ORM attributes; answer from the value just written rather
    # than triggering a lazy load outside the async session.
    return RemindersResponse(
        reminders=[ReminderItem(**item) for item in parse_personal_reminders(stored)]
    )
