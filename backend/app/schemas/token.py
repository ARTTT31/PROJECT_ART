"""
Token Schemas
"""

from typing import Optional
from pydantic import BaseModel


class Token(BaseModel):
    """Token response schema"""

    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data"""

    email: Optional[str] = None
    user_id: Optional[int] = None
