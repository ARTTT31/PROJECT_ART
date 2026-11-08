"""Add per-user finance deletion tombstones

Revision ID: 20261108_finance_deleted
Revises: 20261106_user_totp
Create Date: 2026-11-08 12:00:00.000000

``PUT /profile/finance`` saves the widget's whole list, so a device that still
held a deleted row in its cache used to write it back on the next save. The new
``users.finance_deleted`` column stores ``{entry_id: unix_seconds}`` for rows the
user deleted; every read returns those ids and each client drops them before
merging. NULL means "nothing deleted", so no backfill is required and an
unreadable value is treated as empty.

The migration inspects the existing columns first (same pattern as the TOTP and
personal-reminders migrations) so it is safe against a database created straight
from the models, e.g. a fresh SQLite test run.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261108_finance_deleted'
down_revision = '20261106_user_totp'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'finance_deleted' not in columns:
            batch_op.add_column(sa.Column('finance_deleted', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('finance_deleted')
