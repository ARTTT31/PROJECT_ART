"""Add per-user workspace branding columns

Revision ID: 20261028_user_branding
Revises: 20261022_registration_mode_seed
Create Date: 2026-10-28 12:00:00.000000

The sidebar name/tagline/logo used to be a single workspace-wide setting that
only an admin could edit. Accounts now personalise their own view: these three
nullable columns override the global ``system_settings`` branding for that user,
and NULL keeps the old behaviour (fall back to the workspace-wide value), so no
backfill is needed.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261028_user_branding'
down_revision = '20261022_registration_mode_seed'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has the columns (e.g. a partially applied release).
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'workspace_name' not in columns:
            batch_op.add_column(sa.Column('workspace_name', sa.String(length=100), nullable=True))
        if 'workspace_tagline' not in columns:
            batch_op.add_column(
                sa.Column('workspace_tagline', sa.String(length=200), nullable=True)
            )
        if 'workspace_logo' not in columns:
            batch_op.add_column(sa.Column('workspace_logo', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('workspace_logo')
        batch_op.drop_column('workspace_tagline')
        batch_op.drop_column('workspace_name')
