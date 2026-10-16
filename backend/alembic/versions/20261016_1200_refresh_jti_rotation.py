"""Add refresh-token rotation columns to sessions

Revision ID: 20261016_refresh_jti
Revises: c4e8a91b7d20
Create Date: 2026-10-16 12:00:00.000000

``refresh_jti`` records the refresh token the session currently accepts,
``prev_refresh_jti`` the one it accepted just before (so two tabs refreshing at
the same moment do not get treated as a replay) and ``rotated_at`` when that
rotation happened. All three are nullable: sessions created before this
revision simply upgrade on their next refresh.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261016_refresh_jti'
down_revision = 'c4e8a91b7d20'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the columns (e.g. a partially applied release).
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('sessions')]

    with op.batch_alter_table('sessions', schema=None) as batch_op:
        if 'refresh_jti' not in columns:
            batch_op.add_column(sa.Column('refresh_jti', sa.String(length=64), nullable=True))
        if 'prev_refresh_jti' not in columns:
            batch_op.add_column(sa.Column('prev_refresh_jti', sa.String(length=64), nullable=True))
        if 'rotated_at' not in columns:
            batch_op.add_column(sa.Column('rotated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.drop_column('rotated_at')
        batch_op.drop_column('prev_refresh_jti')
        batch_op.drop_column('refresh_jti')
