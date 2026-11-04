"""Create the notification_logs table

Revision ID: 20261104_notification_logs
Revises: 20261104_personal_reminders
Create Date: 2026-11-04 12:00:00.000000

Durable per-account archive for the bell: the client derives and receives
notifications, then syncs what it showed so the same account reads it back on
another device. Idempotent like the other revisions (safe to re-run).

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261104_notification_logs'
down_revision = '20261104_personal_reminders'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'notification_logs' in inspector.get_table_names():
        return

    op.create_table(
        'notification_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.String(length=80), nullable=False),
        sa.Column('type', sa.String(length=24), nullable=False),
        sa.Column('level', sa.String(length=16), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'client_id', name='uq_notification_user_client'),
    )
    op.create_index('ix_notification_logs_id', 'notification_logs', ['id'])
    op.create_index('ix_notification_logs_user_id', 'notification_logs', ['user_id'])
    op.create_index('ix_notification_logs_occurred_at', 'notification_logs', ['occurred_at'])


def downgrade() -> None:
    op.drop_table('notification_logs')
