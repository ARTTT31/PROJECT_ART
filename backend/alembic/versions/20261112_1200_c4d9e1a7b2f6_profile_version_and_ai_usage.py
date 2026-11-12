"""add profile_version, notification_state and ai_usage

Revision ID: c4d9e1a7b2f6
Revises: b7f1c2d94a10
Create Date: 2026-11-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4d9e1a7b2f6'
down_revision = 'b7f1c2d94a10'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        # server_default is required: existing rows need a value for a NOT NULL
        # column, and the API reads this as an integer on every blob write.
        batch_op.add_column(
            sa.Column('profile_version', sa.Integer(), nullable=False, server_default='0')
        )
        batch_op.add_column(sa.Column('notification_state', sa.Text(), nullable=True))

    op.create_table(
        'ai_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('day', sa.String(length=10), nullable=False),
        sa.Column('requests', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'day', name='uq_ai_usage_user_day'),
    )
    op.create_index('ix_ai_usage_id', 'ai_usage', ['id'], unique=False)
    op.create_index('ix_ai_usage_user_id', 'ai_usage', ['user_id'], unique=False)
    op.create_index('ix_ai_usage_day', 'ai_usage', ['day'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_ai_usage_day', table_name='ai_usage')
    op.drop_index('ix_ai_usage_user_id', table_name='ai_usage')
    op.drop_index('ix_ai_usage_id', table_name='ai_usage')
    op.drop_table('ai_usage')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('notification_state')
        batch_op.drop_column('profile_version')
