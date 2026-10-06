"""Add weather_cache table

Revision ID: c4e8a91b7d20
Revises: 7b325f2deceb
Create Date: 2026-10-06 12:00:00.000000

Persists the last known good upstream weather/geocode payload so the stale
fallback in the proxy survives instance restarts and redeploys.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4e8a91b7d20'
down_revision = '7b325f2deceb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the table (e.g. a partially applied release).
    inspector = sa.inspect(op.get_bind())
    if 'weather_cache' in inspector.get_table_names():
        return

    op.create_table(
        'weather_cache',
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('payload', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )
    op.create_index('ix_weather_cache_updated_at', 'weather_cache', ['updated_at'])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'weather_cache' not in inspector.get_table_names():
        return

    op.drop_index('ix_weather_cache_updated_at', table_name='weather_cache')
    op.drop_table('weather_cache')
