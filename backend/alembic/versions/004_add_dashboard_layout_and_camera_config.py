"""add dashboard_layout and camera_config to users table

Revision ID: 004
Revises: 003
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('dashboard_layout', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('camera_config', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('camera_config')
        batch_op.drop_column('dashboard_layout')
