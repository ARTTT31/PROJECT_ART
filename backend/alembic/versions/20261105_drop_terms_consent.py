"""Drop the PDPA consent columns

The sign-up form never showed a policy page and always sent
``accepted_terms=true``, so the two columns recorded an agreement nobody could
read. The field is gone from the schema and the endpoint; this migration removes
the storage. ``downgrade`` restores the empty columns, not their values.

Revision ID: 20261105_drop_terms_consent
Revises: 20261104_notification_logs
Create Date: 2026-11-05
"""

from alembic import op
import sqlalchemy as sa

revision = "20261105_drop_terms_consent"
down_revision = "20261104_notification_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("terms_version")
        batch_op.drop_column("terms_accepted_at")


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("terms_accepted_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("terms_version", sa.String(length=20), nullable=True))
