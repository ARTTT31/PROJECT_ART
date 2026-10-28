"""
User Schemas
"""

from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.brand_logo import clean_logo_value


class UserBase(BaseModel):
    """Base user schema"""

    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)


class UserRegister(UserBase):
    """Schema for SELF-registration via the unauthenticated /auth/register endpoint.

    Same fields as ``UserCreate`` but WITHOUT a role — server code always assigns
    the    "user" role, so an anonymous caller cannot create an admin.
    """

    password: str = Field(..., min_length=8, max_length=100)
    # Consent and CAPTCHA travel with the sign-up payload. ``accepted_terms`` is
    # enforced by the endpoint (not the schema) so the refusal can say exactly
    # what is missing; ``turnstile_token`` is only required when Turnstile is
    # configured for the deployment.
    accepted_terms: Optional[bool] = None
    turnstile_token: Optional[str] = Field(None, max_length=4096)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserCreate(UserBase):
    """Schema for creating a new user (admin-only endpoints only).

    Do NOT use this schema for the public /auth/register route — use
    ``UserRegister`` there, so the caller cannot choose their own role.
    """

    password: str = Field(..., min_length=8, max_length=100)
    role: Literal["user", "admin"] = "user"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    """Schema for user login"""

    email: str = Field(..., max_length=254)  # RFC max + length-bound log/audit use
    password: str = Field(..., min_length=1, max_length=100)
    session_id: Optional[str] = Field(None, max_length=64)
    user_agent: Optional[str] = Field(None, max_length=500)  # matches DB column
    device_label: Optional[str] = Field(None, max_length=255)  # matches DB column


class ForgotPasswordRequest(BaseModel):
    """Ask for a password-reset link. Turnstile is checked when configured."""

    email: EmailStr
    turnstile_token: Optional[str] = Field(None, max_length=4096)


class ResetPasswordRequest(BaseModel):
    """Redeem a password-reset link."""

    token: str = Field(..., min_length=16, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class VerifyEmailRequest(BaseModel):
    """Redeem an email-verification link."""

    token: str = Field(..., min_length=16, max_length=128)


class ResendVerificationRequest(BaseModel):
    """Ask for a fresh verification email."""

    email: EmailStr


class SelfDeleteRequest(BaseModel):
    """Deleting your own account requires the password one more time."""

    password: str = Field(..., min_length=1, max_length=100)


class UserUpdate(BaseModel):
    """Schema for updating your OWN profile.

    Deliberately has no ``role``, ``is_active``, ``is_locked`` or
    ``accessible_pages``: those are authorization fields, and a self-service
    endpoint must not be a way to grant yourself more access. Admin changes go
    through ``UserAdminUpdate`` and the admin-only endpoints.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None
    quick_links: Optional[str] = None
    dashboard_layout: Optional[str] = None
    camera_config: Optional[str] = None


class UserAdminUpdate(BaseModel):
    """Schema for admin updating user"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    accessible_pages: Optional[str] = None
    password: Optional[str] = None


class UserQuickLinksUpdate(BaseModel):
    """Schema for updating user quick links"""

    quick_links: str = Field(..., min_length=0, max_length=100_000)


class UserDashboardLayoutUpdate(BaseModel):
    """Schema for updating user dashboard layout"""

    dashboard_layout: str = Field(..., min_length=0, max_length=100_000)


class UserCameraConfigUpdate(BaseModel):
    """Schema for updating user camera configuration"""

    camera_config: str = Field(..., min_length=0, max_length=100_000)


class WorkspaceBrandingUpdate(BaseModel):
    """Per-user workspace branding (name / tagline / logo).

    Omitted fields are left untouched; an empty string clears the override so
    the account falls back to the workspace-wide branding. No ``role`` or other
    authorization field: this only personalises what the sidebar shows.
    """

    workspace_name: Optional[str] = Field(None, max_length=100)
    workspace_tagline: Optional[str] = Field(None, max_length=200)
    # Same cap as the global logo: a 256px WebP data URL is tens of KB.
    workspace_logo: Optional[str] = Field(None, max_length=400_000)

    @field_validator("workspace_logo")
    @classmethod
    def validate_logo(cls, value: Optional[str]) -> Optional[str]:
        return clean_logo_value(value)


class WorkspaceBrandingResponse(BaseModel):
    """What an account personalised; empty means "use the workspace value"."""

    workspace_name: Optional[str] = ""
    workspace_tagline: Optional[str] = ""
    workspace_logo: Optional[str] = ""


MAX_QUICK_NOTES = 50


class QuickNote(BaseModel):
    """One item of the dashboard "โน้ตด่วน / To-do วันนี้" list.

    ``id`` is generated by the browser (it only has to be unique inside one
    account's list); ``text`` is bounded so a single note cannot grow into a
    paragraph and push the whole list past the column's practical size.
    """

    id: str = Field(..., min_length=1, max_length=64)
    text: str = Field(..., min_length=1, max_length=200)
    done: bool = False


class QuickNotesUpdate(BaseModel):
    """Replace the whole list — the widget always saves its current state."""

    notes: list[QuickNote] = Field(default_factory=list, max_length=MAX_QUICK_NOTES)


class QuickNotesResponse(BaseModel):
    """The account's notes; an account that never used the widget gets []"""

    notes: list[QuickNote] = Field(default_factory=list)


class UserPasswordChange(BaseModel):
    """Schema for changing password"""

    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class UserAdminCreate(BaseModel):
    """Schema for admin creating a new user"""

    username: str = Field(..., min_length=3, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[str] = "user"
    # Same JSON-as-text shape the admin edit form uses, so the new account can
    # be set up with its page access in one step (NULL means "all pages").
    accessible_pages: Optional[str] = Field(None, max_length=100_000)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    """Schema for user response"""

    id: int
    email: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    name: str
    role: str
    avatar: Optional[str] = None
    quick_links: Optional[str] = None
    dashboard_layout: Optional[str] = None
    camera_config: Optional[str] = None
    accessible_pages: Optional[str] = None
    # Sign-up lifecycle: None (normal account), "pending", "rejected".
    status: Optional[str] = None
    # Address confirmation; None only for accounts that never confirmed.
    email_verified_at: Optional[datetime] = None
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Set while the account sits in the trash (see the admin restore endpoint).
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserTrashResponse(UserResponse):
    """A soft-deleted account, with how long it can still be restored."""

    days_remaining: int
    purge_at: datetime
