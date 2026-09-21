"""remove personal tasks

Revision ID: 20260921_remove_tasks
Revises: 20260921_tasks
Create Date: 2026-09-21 23:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260921_remove_tasks"
down_revision = "20260921_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("personal_tasks")


def downgrade() -> None:
    op.create_table(
        "personal_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=250), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("priority", sa.String(length=12), nullable=False, server_default="medium"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_personal_tasks_user_id", "personal_tasks", ["user_id"])
    op.create_index("ix_personal_tasks_is_completed", "personal_tasks", ["is_completed"])
    op.create_index("ix_personal_tasks_due_date", "personal_tasks", ["due_date"])
