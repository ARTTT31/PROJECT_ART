"""Add per-user finance budget column

Revision ID: 20261030_finance_budget
Revises: 20261030_owner_pw_recovery
Create Date: 2026-10-30 12:00:00.000000

Follows the existing per-user JSON-as-text pattern: a tiny object like
``{"monthly": 15000}``, NULL meaning "no budget set", so no backfill is needed
and a corrupt value reads as unset.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261030_finance_budget'
down_revision = '20261030_owner_pw_recovery'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the column.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'finance_budget' not in columns:
            batch_op.add_column(sa.Column('finance_budget', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('finance_budget')
