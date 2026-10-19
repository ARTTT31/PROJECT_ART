from pydantic import BaseModel, Field
from typing import Optional


class BrandingResponse(BaseModel):
    company_name: str = "ART Workspace"
    company_tagline: Optional[str] = "จัดการวันทำงานของคุณให้ง่ายขึ้น"
    brand_logo_url: Optional[str] = ""


class BrandingUpdate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=100, description="ชื่อทีม บริษัท หรือองค์กร")
    company_tagline: Optional[str] = Field(None, max_length=200, description="สโลแกนหรือคำโปรยสำหรับทีม")
    brand_logo_url: Optional[str] = Field(None, max_length=500, description="URL โลโก้หรือสัญลักษณ์")
