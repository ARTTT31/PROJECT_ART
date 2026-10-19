"""Add registration status to users

Revision ID: 20261019_user_status
Revises: 20261016_soft_delete
Create Date: 2026-10-19 12:00:00.000000

``users.status`` records the sign-up lifecycle now that the API can be run in
``approval`` mode: ``pending`` is a request an admin has not decided on yet and
``rejected`` is a refused request. NULL means a normal account, which is every
row that exists today — so no backfill is needed. A pending/rejected row is also
``is_active=False``; that flag keeps being what login and every authenticated
request check.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261019_user_status'
down_revision = '20261016_soft_delete'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the column (e.g. a partially applied release).
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    if 'status' not in columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('status', sa.String(length=20), nullable=True))

    indexes = [i['name'] for i in sa.inspect(conn).get_indexes('users')]
    if 'ix_users_status' not in indexes:
        op.create_index('ix_users_status', 'users', ['status'])


def downgrade() -> None:
    indexes = [i['name'] for i in sa.inspect(op.get_bind()).get_indexes('users')]
    if 'ix_users_status' in indexes:
        op.drop_index('ix_users_status', table_name='users')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('status')
