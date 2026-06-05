"""
User Schemas
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, validator


class UserBase(BaseModel):
    """Base user schema"""
    
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    """Schema for creating a new user"""
    
    password: str = Field(..., min_length=8, max_length=100)
    role: Optional[str] = "user"
    
    @validator("password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    """Schema for user login"""
    
    email: EmailStr
    password: str
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    device_label: Optional[str] = None


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None
    quick_links: Optional[str] = None


class UserPasswordChange(BaseModel):
    """Schema for changing password"""
    
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
    
    @validator("new_password")
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class UserResponse(UserBase):
    """Schema for user response"""
    
    id: int
    role: str
    avatar: Optional[str] = None
    quick_links: Optional[str] = None
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
