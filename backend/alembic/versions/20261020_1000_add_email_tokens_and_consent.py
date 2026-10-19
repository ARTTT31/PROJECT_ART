"""Add email_tokens table, email verification and terms consent columns

Revision ID: 20261020_email_tokens
Revises: 20261019_user_status
Create Date: 2026-10-20 10:00:00.000000

Three additions that go together with the account-email flows:

- ``email_tokens`` backs password reset and email verification links (only the
  hash is stored, single use, expiring).
- ``users.email_verified_at`` records address confirmation. Every existing row
  is backfilled from ``created_at``: those accounts predate verification and
  were admitted by other means (admin creation, Google), so treating them as
  verified is the honest reading — a NULL would suddenly demand verification
  from people who never needed it.
- ``users.terms_accepted_at`` / ``terms_version`` record PDPA consent.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20261020_email_tokens'
down_revision = '20261019_user_status'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent like the other migrations: safe to re-run against a database
    # that already has some of this applied (e.g. a partially applied release).
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    user_columns = [c['name'] for c in inspector.get_columns('users')]

    if 'email_verified_at' not in user_columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('email_verified_at', sa.DateTime(), nullable=True))
    if 'terms_accepted_at' not in user_columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('terms_accepted_at', sa.DateTime(), nullable=True))
    if 'terms_version' not in user_columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('terms_version', sa.String(length=20), nullable=True))

    # Backfill: pre-existing accounts are treated as verified (see module docstring).
    op.execute(
        "UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL"
    )

    if 'email_tokens' not in inspector.get_table_names():
        op.create_table(
            'email_tokens',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('purpose', sa.String(length=20), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('used_at', sa.DateTime(), nullable=True),
            # TimestampMixin columns are NOT NULL in the model; the migration
            # must say the same or `alembic check` reports drift.
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_email_tokens_id', 'email_tokens', ['id'])
        op.create_index('ix_email_tokens_user_id', 'email_tokens', ['user_id'])
        op.create_index('ix_email_tokens_purpose', 'email_tokens', ['purpose'])
        op.create_index('ix_email_tokens_token_hash', 'email_tokens', ['token_hash'], unique=True)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'email_tokens' in inspector.get_table_names():
        for index_name in (
            'ix_email_tokens_token_hash',
            'ix_email_tokens_purpose',
            'ix_email_tokens_user_id',
            'ix_email_tokens_id',
        ):
            op.drop_index(index_name, table_name='email_tokens')
        op.drop_table('email_tokens')

    user_columns = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('users')]
    for column_name in ('terms_version', 'terms_accepted_at', 'email_verified_at'):
        if column_name in user_columns:
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.drop_column(column_name)
