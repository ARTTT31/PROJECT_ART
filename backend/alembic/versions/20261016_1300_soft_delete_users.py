"""Add soft-delete column to users

Revision ID: 20261016_soft_delete
Revises: 20261016_refresh_jti
Create Date: 2026-10-16 13:00:00.000000

``users.deleted_at`` turns the admin "delete user" action into a recoverable
one: the row (and therefore its audit-log references) stays, the account is
hidden from every listing and locked out, and a housekeeping pass removes it
for good once the retention window has elapsed. NULL means a live account, so
existing rows need no backfill.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261016_soft_delete'
down_revision = '20261016_refresh_jti'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the column (e.g. a partially applied release).
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    if 'deleted_at' not in columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))

    indexes = [i['name'] for i in sa.inspect(conn).get_indexes('users')]
    if 'ix_users_deleted_at' not in indexes:
        op.create_index('ix_users_deleted_at', 'users', ['deleted_at'])


def downgrade() -> None:
    indexes = [i['name'] for i in sa.inspect(op.get_bind()).get_indexes('users')]
    if 'ix_users_deleted_at' in indexes:
        op.drop_index('ix_users_deleted_at', table_name='users')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('deleted_at')
