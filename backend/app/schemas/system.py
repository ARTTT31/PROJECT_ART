import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Only these two shapes are rendered by the UI: an absolute http(s) link, or the
# WebP/PNG data URL written by the logo upload endpoint. Anything else (notably
# `javascript:` or an SVG data URL) is refused before it reaches the database.
_LOGO_URL_PATTERN = re.compile(
    r"^(https?://\S+$|data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$)",
    re.IGNORECASE,
)


class BrandingResponse(BaseModel):
    company_name: str = "ART Workspace"
    company_tagline: Optional[str] = "จัดการวันทำงานของคุณให้ง่ายขึ้น"
    brand_logo_url: Optional[str] = ""
    registration_mode: Optional[str] = "approval"


class BrandingUpdate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=100, description="ชื่อทีม บริษัท หรือองค์กร")
    company_tagline: Optional[str] = Field(None, max_length=200, description="สโลแกนหรือคำโปรยสำหรับทีม")
    # A URL is short, but the admin UI also stores an uploaded logo as a WebP
    # data URL (~256px, tens of KB). The cap stays well below the DB Text limit
    # so an oversized payload is a validation error, not a silent truncation.
    brand_logo_url: Optional[str] = Field(
        None, max_length=400_000, description="URL โลโก้หรือสัญลักษณ์"
    )
    registration_mode: Optional[str] = Field(None, description="โหมดการรับสมัครสมาชิก (closed, approval, open)")

    @field_validator("brand_logo_url")
    @classmethod
    def validate_logo_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            return ""
        if not _LOGO_URL_PATTERN.match(cleaned):
            raise ValueError("โลโก้ต้องเป็นลิงก์ http(s) หรือไฟล์รูปภาพที่อัปโหลดผ่านระบบเท่านั้น")
        return cleaned
