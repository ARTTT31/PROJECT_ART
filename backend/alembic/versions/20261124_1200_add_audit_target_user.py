"""add audit_logs.target_user_id

Revision ID: 20261124_1200
Revises: 20261119_normalise_branding
Create Date: 2026-11-24 12:00:00

An audit row already recorded the actor (`user_id`). "Who was this done to"
only existed inside `details` free text, where it could not be filtered or
joined. Revoking another account's session is the first action that needs it.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261124_1200"
down_revision = "20261119_normalise_branding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.add_column(sa.Column("target_user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_audit_logs_target_user_id_users",
            "users",
            ["target_user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_audit_logs_target_user_id", ["target_user_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.drop_index("ix_audit_logs_target_user_id")
        batch_op.drop_constraint(
            "fk_audit_logs_target_user_id_users", type_="foreignkey"
        )
        batch_op.drop_column("target_user_id")
