"""add trusted_devices

Revision ID: b8e2f5c10a97
Revises: c4d9e1a7b2f6
Create Date: 2026-11-18 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8e2f5c10a97"
down_revision = "c4d9e1a7b2f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trusted_devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        # jti of the signed cookie; unique so one cookie cannot be duplicated
        # onto another row.
        sa.Column("token_id", sa.String(length=64), nullable=False),
        # Salt at issue time: a password change or 2FA reset invalidates every
        # older row without touching them.
        sa.Column("salt_version", sa.String(length=32), nullable=False),
        sa.Column("device_label", sa.String(length=255), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_trusted_devices_id", "trusted_devices", ["id"], unique=False
    )
    op.create_index(
        "ix_trusted_devices_user_id", "trusted_devices", ["user_id"], unique=False
    )
    op.create_index(
        "ix_trusted_devices_token_id",
        "trusted_devices",
        ["token_id"],
        unique=True,
    )
    op.create_index(
        "ix_trusted_devices_expires_at",
        "trusted_devices",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_trusted_devices_expires_at", table_name="trusted_devices")
    op.drop_index("ix_trusted_devices_token_id", table_name="trusted_devices")
    op.drop_index("ix_trusted_devices_user_id", table_name="trusted_devices")
    op.drop_index("ix_trusted_devices_id", table_name="trusted_devices")
    op.drop_table("trusted_devices")
