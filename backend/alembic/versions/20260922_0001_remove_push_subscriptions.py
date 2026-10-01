"""remove obsolete web push subscriptions

Revision ID: 20260922_no_push
Revises: 20260921_remove_tasks
Create Date: 2026-09-22 00:01:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260922_no_push"
down_revision = "20260921_remove_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if "push_subscriptions" in columns:
        op.drop_column("users", "push_subscriptions")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if "push_subscriptions" not in columns:
        op.add_column("users", sa.Column("push_subscriptions", sa.Text(), nullable=True))
