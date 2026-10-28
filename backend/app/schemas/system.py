from pydantic import BaseModel, Field
from typing import Optional


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
