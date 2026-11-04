"""Add per-user planner reminders column

Revision ID: 20261104_personal_reminders
Revises: 20261030_finance_budget
Create Date: 2026-11-04 10:00:00.000000

Same pattern as ``quick_notes``/``watchlist``: one JSON array as text, NULL
meaning "never used", so an existing account needs no backfill and a corrupt
value reads as an empty list.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261104_personal_reminders'
down_revision = '20261030_finance_budget'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'personal_reminders' not in columns:
            batch_op.add_column(sa.Column('personal_reminders', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('personal_reminders')
