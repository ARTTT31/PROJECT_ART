"""Add TOTP two-factor columns to users

Revision ID: 20261106_user_totp
Revises: 20261105_drop_terms_consent
Create Date: 2026-11-06 10:00:00.000000

Three columns, all nullable/enabled-by-default so existing accounts keep
working untouched:

* ``totp_secret`` — base32 shared secret, written when setup starts.
* ``totp_enabled`` — the switch that makes the secret authoritative. Defaults
  to false, so a half-finished setup cannot lock anyone out.
* ``totp_recovery_codes`` — JSON array of SHA-256 hashes, NULL until enabled.

The migration inspects the existing columns first (same pattern as the
personal-reminders migration) so it is safe on a database that was created
from the models directly, e.g. a fresh SQLite test run.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261106_user_totp'
down_revision = '20261105_drop_terms_consent'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'totp_secret' not in columns:
            batch_op.add_column(sa.Column('totp_secret', sa.Text(), nullable=True))
        if 'totp_enabled' not in columns:
            batch_op.add_column(
                sa.Column(
                    'totp_enabled',
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )
        if 'totp_recovery_codes' not in columns:
            batch_op.add_column(
                sa.Column('totp_recovery_codes', sa.Text(), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('totp_recovery_codes')
        batch_op.drop_column('totp_enabled')
        batch_op.drop_column('totp_secret')
