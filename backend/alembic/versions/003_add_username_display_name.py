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
    # 1. Add username and display_name columns
    op.add_column('users', sa.Column('username', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('display_name', sa.String(length=255), nullable=True))
    
    # 2. Create unique index for username
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    
    # 3. Alter email column to be nullable
    op.alter_column('users', 'email',
                    existing_type=sa.String(length=255),
                    nullable=True)


def downgrade() -> None:
    # 1. Revert email column to not nullable
    # Note: Make sure there are no null values in email before running downgrade, or it will fail
    op.alter_column('users', 'email',
                    existing_type=sa.String(length=255),
                    nullable=False)
    
    # 2. Drop unique index for username
    op.drop_index('ix_users_username', table_name='users')
    
    # 3. Drop columns
    op.drop_column('users', 'display_name')
    op.drop_column('users', 'username')
