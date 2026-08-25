"""add username and display_name, make email nullable

Revision ID: 003
Revises: 002
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add username and display_name columns, create index, alter email column
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('username', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('display_name', sa.String(length=255), nullable=True))
        batch_op.create_index('ix_users_username', ['username'], unique=True)
        batch_op.alter_column('email',
                              existing_type=sa.String(length=255),
                              nullable=True)


def downgrade() -> None:
    # 1. Revert changes
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('email',
                              existing_type=sa.String(length=255),
                              nullable=False)
        batch_op.drop_index('ix_users_username')
        batch_op.drop_column('display_name')
        batch_op.drop_column('username')
