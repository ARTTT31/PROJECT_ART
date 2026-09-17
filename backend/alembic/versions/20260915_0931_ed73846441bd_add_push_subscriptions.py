"""add_push_subscriptions

Revision ID: ed73846441bd
Revises: 004
Create Date: 2026-09-15 09:31:54.934960

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ed73846441bd'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('push_subscriptions', sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'push_subscriptions')
