"""Add missing indexes and fix nullable constraints

- Add index on sessions.user_id (frequently joined)
- Add index on sessions.expires_at (cleanup queries)
- Add index on sessions.last_activity (cleanup queries)
- Add index on audit_logs.user_id (frequently filtered)
- Add index on audit_logs.action (frequently filtered)
- Add index on audit_logs.created_at (ordering queries)
- Fix created_at/updated_at nullable constraint on users + sessions tables

Revision ID: 002
Revises: 001
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add missing indexes for query performance ──

    # sessions: user_id is always joined/queried
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])
    # sessions: expires_at used by cleanup queries (session_cleanup.py)
    op.create_index('ix_sessions_expires_at', 'sessions', ['expires_at'])
    # sessions: last_activity used by stale inactive cleanup
    op.create_index('ix_sessions_last_activity', 'sessions', ['last_activity'])

    # audit_logs: user_id is filtered in admin views
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    # audit_logs: action is filtered frequently
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    # audit_logs: created_at is used for ordering/date range queries
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

    # ── Fix nullable constraints (align ORM with DB schema) ──
    bind = op.get_bind()
    is_postgres = bind.dialect.name == 'postgresql'

    if is_postgres:
        op.execute('SET session_replication_role = replica;')

    # users: created_at / updated_at should not be nullable
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('created_at',
                              existing_type=sa.DateTime(),
                              nullable=False)
        batch_op.alter_column('updated_at',
                              existing_type=sa.DateTime(),
                              nullable=False)

    # sessions: created_at / updated_at should not be nullable
    with op.batch_alter_table('sessions') as batch_op:
        batch_op.alter_column('created_at',
                              existing_type=sa.DateTime(),
                              nullable=False)
        batch_op.alter_column('updated_at',
                              existing_type=sa.DateTime(),
                              nullable=False)

    if is_postgres:
        op.execute('SET session_replication_role = DEFAULT;')


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_sessions_user_id', table_name='sessions')
    op.drop_index('ix_sessions_expires_at', table_name='sessions')
    op.drop_index('ix_sessions_last_activity', table_name='sessions')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')

    # Revert nullable constraints
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('created_at',
                              existing_type=sa.DateTime(),
                              nullable=True)
        batch_op.alter_column('updated_at',
                              existing_type=sa.DateTime(),
                              nullable=True)

    with op.batch_alter_table('sessions') as batch_op:
        batch_op.alter_column('created_at',
                              existing_type=sa.DateTime(),
                              nullable=True)
        batch_op.alter_column('updated_at',
                              existing_type=sa.DateTime(),
                              nullable=True)