"""One-time owner password recovery

The owner account (thanyapong.art@gmail.com) could not sign in and no
database credentials were available locally, so the recovery runs through the
regular deploy pipeline instead: this migration resets the account's password
hash, clears every lock flag, and restores it to an active state. If the
account does not exist at all (fresh/lost database), it is created as an
admin. The stored value is a one-way Argon2id hash, never the plain password.

Revision ID: 20261030_owner_pw_recovery
Revises: 20261029_user_main_menu
Create Date: 2026-10-30 10:00:00.000000

"""

from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261030_owner_pw_recovery"
down_revision: Union[str, None] = "20261029_user_main_menu"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OWNER_EMAIL = "thanyapong.art@gmail.com"
OWNER_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$1jieXCCBrGiI8j+fJ4iFUA$"
    "6nXgNtifNJNrGT9AbpNMXIkamMSItI7FDP4xl0da5y0"
)


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.utcnow()

    row = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": OWNER_EMAIL},
    ).first()

    if row is None:
        conn.execute(
            sa.text(
                """
                INSERT INTO users (
                    email, username, display_name, hashed_password, name, role,
                    status, email_verified_at, is_active, is_locked,
                    failed_login_attempts, locked_until, deleted_at,
                    created_at, updated_at
                )
                VALUES (
                    :email, NULL, :display_name, :hash, :name, 'admin',
                    NULL, :now, TRUE, FALSE,
                    0, NULL, NULL,
                    :now, :now
                )
                """
            ),
            {
                "email": OWNER_EMAIL,
                "display_name": "Thanyapong",
                "name": "Thanyapong",
                "hash": OWNER_PASSWORD_HASH,
                "now": now,
            },
        )
        return

    conn.execute(
        sa.text(
            """
            UPDATE users SET
                hashed_password = :hash,
                is_active = TRUE,
                is_locked = FALSE,
                locked_until = NULL,
                failed_login_attempts = 0,
                status = NULL,
                deleted_at = NULL,
                email_verified_at = COALESCE(email_verified_at, :now),
                updated_at = :now
            WHERE email = :email
            """
        ),
        {
            "email": OWNER_EMAIL,
            "hash": OWNER_PASSWORD_HASH,
            "now": now,
        },
    )


def downgrade() -> None:
    # Intentionally a no-op: a password recovery must never be undone by a
    # downgrade, and re-locking the owner account would only cause harm.
    pass
