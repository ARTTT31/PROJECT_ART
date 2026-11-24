from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserBrief(BaseModel):
    id: int
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    # `ip_address` is deliberately not exposed: the audit row keeps it in the
    # database, but no browser needs every user's address to read the log.
    user_agent: Optional[str] = None
    created_at: datetime
    user: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)
