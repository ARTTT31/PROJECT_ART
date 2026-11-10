"""add_user_ai_settings

Revision ID: b7f1c2d94a10
Revises: d73ba7f30cb3
Create Date: 2026-11-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7f1c2d94a10'
down_revision = 'd73ba7f30cb3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ai_provider', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('ai_api_key_enc', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('ai_base_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('ai_model', sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('ai_model')
        batch_op.drop_column('ai_base_url')
        batch_op.drop_column('ai_api_key_enc')
        batch_op.drop_column('ai_provider')
