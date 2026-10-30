"""
User Model
"""

from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """User model for authentication and profile"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))

    # Profile fields
    avatar: Mapped[str | None] = mapped_column(Text)  # Base64 or URL
    role: Mapped[str] = mapped_column(String(50), default="user")  # user, admin

    # Per-user workspace branding. NULL means "use the workspace-wide value from
    # system_settings", so these only ever hold what this account changed.
    workspace_name: Mapped[str | None] = mapped_column(String(100))
    workspace_tagline: Mapped[str | None] = mapped_column(String(200))
    workspace_logo: Mapped[str | None] = mapped_column(Text)

    # Quick links (JSON stored as text)
    quick_links: Mapped[str | None] = mapped_column(Text)

    # Dashboard layout and widget preferences (JSON stored as text)
    dashboard_layout: Mapped[str | None] = mapped_column(Text)

    # Quick notes / to-do list for the dashboard widget (JSON array as text).
    # NULL means "never used", which the API reports as an empty list.
    quick_notes: Mapped[str | None] = mapped_column(Text)

    # Income/expense entries for the finance widget (JSON array as text).
    finance_entries: Mapped[str | None] = mapped_column(Text)

    # Monthly spending budget for the finance widget (JSON object as text).
    # NULL means "no budget set", so an untouched account needs no backfill.
    finance_budget: Mapped[str | None] = mapped_column(Text)

    # Symbols followed by the watchlist widget (JSON array as text).
    watchlist: Mapped[str | None] = mapped_column(Text)

    # Sidebar order and which pages are switched on (JSON array as text). Kept
    # per account so arranging the menu on one device follows the user to the
    # next one instead of dying with that browser's localStorage.
    main_menu: Mapped[str | None] = mapped_column(Text)

    # Camera streams configuration (JSON stored as text)
    camera_config: Mapped[str | None] = mapped_column(Text)
    accessible_pages: Mapped[str | None] = mapped_column(Text)
    # Registration lifecycle: NULL means a normal account (every row created
    # before this column existed), ``pending`` is someone waiting for an admin
    # to approve their sign-up request, and ``rejected`` is a refused request.
    # A pending/rejected account is also ``is_active=False`` — that flag is what
    # login and every authenticated request check — so this column only records
    # *why* it is inactive. Kept as text (not an enum) so a new state is an
    # application change rather than a database migration.
    status: Mapped[str | None] = mapped_column(String(20), index=True)
    # When the address was confirmed. NULL means "never confirmed" — the
    # migration backfills every pre-existing row to its created_at, so only an
    # account that went through password self-registration can be unverified.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    # PDPA consent record: when the account accepted the terms, and which
    # revision of them. Kept even if the account is later deactivated, because
    # consent must remain provable.
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
    terms_version: Mapped[str | None] = mapped_column(String(20))
    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    # Soft delete. A NULL value means a live account; a timestamp means the
    # account is in the trash: it is hidden from every list, cannot log in
    # (is_active is cleared with it) and is permanently purged once the
    # retention window in ``settings.USER_DELETE_RETENTION_DAYS`` has passed.
    # Keeping the row is also what keeps ``audit_logs.user_id`` resolvable.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    # Login tracking
    last_login: Mapped[datetime | None] = mapped_column(DateTime)
    last_login_ip: Mapped[str | None] = mapped_column(String(45))
    last_login_device: Mapped[str | None] = mapped_column(String(255))

    # Failed login attempts
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"
