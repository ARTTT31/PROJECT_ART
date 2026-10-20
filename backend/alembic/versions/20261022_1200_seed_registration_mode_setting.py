"""Backfill missing system settings on databases that already had the table

Revision ID: 20261022_registration_mode_seed
Revises: 20261021_system_settings
Create Date: 2026-10-22 12:00:00.000000

The previous revision created ``system_settings`` and seeded the branding rows
only when the table did not exist yet. Deployments that already had the table
(any database created before the branding feature) therefore kept their old
rows and never received the ``registration_mode`` seed. The auth endpoint then
fell back to ``REGISTRATION_MODE`` (``closed`` by default), while the branding
endpoint reported ``approval`` — the sign-up form appeared, every submission was
refused, and nothing reached the admin approval queue.

This revision backfills only keys that are missing. Existing values are never
overwritten, so an admin who deliberately chose ``closed``/``open`` keeps that
choice.
"""

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20261022_registration_mode_seed"
down_revision = "20261021_system_settings"
branch_labels = None
depends_on = None


DEFAULTS = (
    (
        "company_name",
        "ART Workspace",
        "ชื่อทีม บริษัท หรือองค์กร",
    ),
    (
        "company_tagline",
        "จัดการวันทำงานของคุณให้ง่ายขึ้น",
        "สโลแกนหรือคำโปรยสำหรับทีม",
    ),
    (
        "brand_logo_url",
        "",
        "URL โลโก้หรือสัญลักษณ์ของแบรนด์ (ว่าง = ใช้โลโก้เริ่มต้น)",
    ),
    (
        "registration_mode",
        "approval",
        "โหมดการรับสมัครสมาชิก (closed, approval, open)",
    ),
)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "system_settings" not in inspector.get_table_names():
        # A database so old that the table itself is missing is owned by the
        # previous revision; running it first will create and seed the table.
        return

    existing = {
        row[0]
        for row in conn.execute(sa.text("SELECT key FROM system_settings")).fetchall()
    }
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for key, value, description in DEFAULTS:
        if key in existing:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO system_settings "
                "(key, value, description, created_at, updated_at) "
                "VALUES (:key, :value, :description, :created_at, :updated_at)"
            ),
            {
                "key": key,
                "value": value,
                "description": description,
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    # Data backfill: deleting the rows would be destructive for a deployment
    # that has since edited them, and leaving them is harmless.
    pass
