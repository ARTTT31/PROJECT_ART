"""Add per-user quick notes column

Revision ID: 20261028_quick_notes
Revises: 20261028_user_branding
Create Date: 2026-10-28 14:00:00.000000

``users.quick_notes`` holds the dashboard "โน้ตด่วน / To-do วันนี้" list as a
JSON array in a text column, the same shape the existing ``quick_links`` and
``dashboard_layout`` columns already use. NULL means the account never opened
the widget, which the API reports as an empty list — so no backfill is needed.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261028_quick_notes'
down_revision = '20261028_user_branding'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the column (e.g. a partially applied release).
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    if 'quick_notes' not in columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('quick_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('quick_notes')
