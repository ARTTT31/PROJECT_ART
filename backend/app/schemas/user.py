"""
User Schemas
"""

from typing import Literal, Optional
from datetime import date, datetime
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
    # This endpoint must not be a way around the dedicated endpoints' caps. The
    # avatar cap matches the 1MB upload path after base64 expansion; the three
    # JSON blobs match their dedicated schemas. Without these, a caller could
    # persist megabytes that every /profile/me response then loads.
    avatar: Optional[str] = Field(None, max_length=2_000_000)
    quick_links: Optional[str] = Field(None, max_length=100_000)
    dashboard_layout: Optional[str] = Field(None, max_length=100_000)
    camera_config: Optional[str] = Field(None, max_length=100_000)


class UserAdminUpdate(BaseModel):
    """Schema for admin updating user"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    accessible_pages: Optional[str] = Field(None, max_length=10_000)
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class UserQuickLinksUpdate(BaseModel):
    """Schema for updating user quick links"""

    quick_links: str = Field(..., min_length=0, max_length=100_000)


class UserMainMenuUpdate(BaseModel):
    """Schema for updating the sidebar menu config (JSON array as text)"""

    main_menu: str = Field(..., min_length=0, max_length=20_000)


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


class FinanceEntry(BaseModel):
    """One income/expense row of the dashboard finance widget."""

    id: str = Field(..., min_length=1, max_length=64)
    type: Literal["income", "expense"]
    label: str = Field("", max_length=60)
    amount: float = Field(..., gt=0, le=1_000_000_000, allow_inf_nan=False)
    # Local calendar day (YYYY-MM-DD); the widget groups by day, not by instant.
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    # Free-text spending category ("อาหาร", "เดินทาง", ...). Optional: rows
    # saved before categories existed simply have no value.
    category: Optional[str] = Field(None, max_length=40)

    @field_validator("date")
    @classmethod
    def validate_calendar_date(cls, value: str) -> str:
        """Reject well-shaped but impossible days (2026-02-31) at the edge.

        The JSON reader also validates stored rows, but a bad request should
        return 422 instead of being silently dropped from the saved list.
        """
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date must be a real calendar day") from exc
        return value


class FinanceUpdate(BaseModel):
    """Replace the whole entry list — the widget saves its current state."""

    entries: list[FinanceEntry] = Field(default_factory=list, max_length=2000)
    # Monthly spending budget; omitted/null leaves the stored value untouched
    # only when the client never sends the field — the widget always sends it so
    # clearing the input clears the budget.
    budget: Optional[float] = Field(None, ge=0, le=1_000_000_000, allow_inf_nan=False)


class FinanceResponse(BaseModel):
    entries: list[FinanceEntry] = Field(default_factory=list)
    budget: Optional[float] = None


class WatchlistItem(BaseModel):
    """A symbol followed by the watchlist widget (e.g. PTT.BK, BTC-USD)."""

    # Same character set the serializer accepts; a malformed symbol is a 422
    # instead of silently disappearing from the saved list.
    symbol: str = Field(..., min_length=1, max_length=24, pattern=r"^[A-Za-z0-9.^=\-]+$")
    label: Optional[str] = Field(None, max_length=40)

    @field_validator("symbol", mode="before")
    @classmethod
    def normalise_symbol(cls, value: object) -> object:
        """Trim and upper-case before the character-set check runs."""
        return value.strip().upper() if isinstance(value, str) else value


class WatchlistUpdate(BaseModel):
    symbols: list[WatchlistItem] = Field(default_factory=list, max_length=30)


class WatchlistResponse(BaseModel):
    symbols: list[WatchlistItem] = Field(default_factory=list)


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
