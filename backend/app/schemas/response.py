"""
Standard API Response Schemas
"""
from typing import Optional, Any
from pydantic import BaseModel


class ResponseModel(BaseModel):
    """Standard success response"""
    
    result: str = "success"
    message: Optional[str] = None
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response"""
    
    result: str = "error"
    code: str
    message: str
    details: Optional[Any] = None
