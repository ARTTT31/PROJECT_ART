"""Add user_cameras table for per-account encrypted RTSP cameras.

Revision ID: 20261129_user_cameras
Revises: 20261127_finance_tables
Create Date: 2026-11-29 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20261129_user_cameras"
down_revision = "20261127_finance_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_cameras" in inspector.get_table_names():
        return

    op.create_table(
        "user_cameras",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stream_key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("preset", sa.String(length=32), nullable=False, server_default="custom"),
        sa.Column("rtsp_url_encrypted", sa.Text(), nullable=False),
        sa.Column("masked_host", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("codec", sa.String(length=16), nullable=True),
        sa.Column("resolution", sa.String(length=32), nullable=True),
        sa.Column("fps", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_cameras_id", "user_cameras", ["id"])
    op.create_index("ix_user_cameras_user_id", "user_cameras", ["user_id"])
    op.create_index("ix_user_cameras_stream_key", "user_cameras", ["stream_key"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_cameras" not in inspector.get_table_names():
        return
    op.drop_index("ix_user_cameras_stream_key", table_name="user_cameras")
    op.drop_index("ix_user_cameras_user_id", table_name="user_cameras")
    op.drop_index("ix_user_cameras_id", table_name="user_cameras")
    op.drop_table("user_cameras")
