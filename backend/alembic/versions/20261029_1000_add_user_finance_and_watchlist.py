"""Add per-user finance entries and watchlist columns

Revision ID: 20261029_finance_watchlist
Revises: 20261028_quick_notes
Create Date: 2026-10-29 10:00:00.000000

Both columns follow the existing per-user JSON-as-text pattern
(``quick_notes`` / ``quick_links``): a JSON array, NULL meaning "never used",
so no backfill is needed and a corrupt value reads as an empty list.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261029_finance_watchlist'
down_revision = '20261028_quick_notes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the column.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'finance_entries' not in columns:
            batch_op.add_column(sa.Column('finance_entries', sa.Text(), nullable=True))
        if 'watchlist' not in columns:
            batch_op.add_column(sa.Column('watchlist', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('watchlist')
        batch_op.drop_column('finance_entries')
