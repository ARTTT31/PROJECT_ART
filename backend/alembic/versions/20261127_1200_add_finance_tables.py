"""Add the finance tables and copy the JSON columns into them

Revision ID: 20261127_finance_tables
Revises: 20261124_1200
Create Date: 2026-11-27 12:00:00.000000

Additive on purpose: ``users.finance_entries``, ``users.finance_budget`` and
``users.finance_deleted`` stay in place and are only dropped in a later
revision, once the tables have served real traffic. That keeps rollback cheap —
``downgrade()`` first rebuilds the JSON from the tables (rows written after the
deploy exist nowhere else), then drops them.

The backfill itself lives in ``app.services.finance_service`` so the test suite
can drive it directly; it parses with the same functions the API used on read,
so a row visible before the migration is a row written to the tables.

The table checks make the revision safe against a database created straight from
the models (a fresh SQLite test run) and safe to re-run after a partial failure —
SQLite has no transactional DDL.
"""
from alembic import op
import sqlalchemy as sa

from app.services.finance_service import backfill_finance_from_json, rebuild_finance_json


# revision identifiers, used by Alembic.
revision = "20261127_finance_tables"
down_revision = "20261124_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not inspector.has_table("finance_entries"):
        op.create_table(
            "finance_entries",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            # The id the widget already uses; unique per account, not globally.
            sa.Column("client_id", sa.String(length=64), nullable=False),
            sa.Column("entry_type", sa.String(length=10), nullable=False),
            sa.Column("label", sa.String(length=60), nullable=False),
            # Money as a real numeric, not the float the JSON held.
            sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
            sa.Column("entry_date", sa.Date(), nullable=False),
            sa.Column("category", sa.String(length=40), nullable=True),
            # Order inside the widget's list; the same-day order the JSON kept.
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "client_id", name="uq_finance_entries_user_client"
            ),
        )
        op.create_index(
            "ix_finance_entries_user_position",
            "finance_entries",
            ["user_id", "position"],
            unique=False,
        )

    if not inspector.has_table("finance_settings"):
        op.create_table(
            "finance_settings",
            sa.Column("user_id", sa.Integer(), nullable=False),
            # NULL means "no budget set", the same thing the absent JSON key meant.
            sa.Column("monthly_budget", sa.Numeric(precision=14, scale=2), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if not inspector.has_table("finance_deleted_entries"):
        op.create_table(
            "finance_deleted_entries",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("client_id", sa.String(length=64), nullable=False),
            sa.Column("deleted_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "client_id"),
        )

    # Only meaningful once the legacy columns exist (a database that predates
    # 20261029 has neither the table shape nor any finance data).
    user_columns = {column["name"] for column in sa.inspect(conn).get_columns("users")}
    if {
        "finance_entries",
        "finance_budget",
        "finance_deleted",
    }.issubset(user_columns):
        counters = backfill_finance_from_json(conn)
        print(f"[finance] backfill {counters}")
    else:
        print("[finance] legacy columns absent; nothing to backfill")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if inspector.has_table("finance_entries"):
        # Back into the JSON columns first: a rollback that loses rows written
        # after the deploy is not a rollback.
        counters = rebuild_finance_json(conn)
        print(f"[finance] rebuild {counters}")

    if inspector.has_table("finance_entries"):
        op.drop_index("ix_finance_entries_user_position", table_name="finance_entries")
        op.drop_table("finance_entries")
    if inspector.has_table("finance_settings"):
        op.drop_table("finance_settings")
    if inspector.has_table("finance_deleted_entries"):
        op.drop_table("finance_deleted_entries")
