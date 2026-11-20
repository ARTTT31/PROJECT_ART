"""Normalise the retired product name stored in branding columns

Revision ID: 20261119_normalise_branding
Revises: 20261118_trusted_devices
Create Date: 2026-11-19 10:00:00.000000

The workspace is nameable now, so the old seeded product name must not survive
in the database: `system_settings.company_name` still held it, which is why
existing installs kept showing the old name after the rename. Accounts that had
copied it into their personal override are reset to NULL so they follow the
workspace value from now on.

Only the retired value is touched — an admin who has already chosen a name is
left alone. Re-running is a no-op.
"""

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

from app.core.branding import DEFAULT_COMPANY_NAME, LEGACY_COMPANY_NAMES

# revision identifiers, used by Alembic.
revision = "20261119_normalise_branding"
down_revision = "b8e2f5c10a97"
branch_labels = None
depends_on = None

# The legacy values live in app.core.branding and are bound as parameters:
# keeping one predicate there is what stops the migration and the read path
# drifting.
def _legacy_rows(conn, table: str, columns: tuple[str, ...], where: str) -> list[tuple]:
    values = sorted(LEGACY_COMPANY_NAMES)
    placeholders = ", ".join(f":name{index}" for index in range(len(values)))
    params = {f"name{index}": value for index, value in enumerate(values)}
    sql = f"SELECT {', '.join(columns)} FROM {table} WHERE LOWER(TRIM({where})) IN ({placeholders})"
    return conn.execute(sa.text(sql), params).fetchall()


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if "system_settings" in tables:
        rows = _legacy_rows(conn, "system_settings", ("key",), "value")
        for (key,) in rows:
            # Only the workspace name was seeded with the product name; any
            # other row that happens to hold it is left untouched.
            if key != "company_name":
                continue
            conn.execute(
                sa.text(
                    "UPDATE system_settings SET value = :value, updated_at = :updated_at "
                    "WHERE key = 'company_name'"
                ),
                {"value": DEFAULT_COMPANY_NAME, "updated_at": now},
            )

    if "users" in tables:
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "workspace_name" in columns:
            rows = _legacy_rows(conn, "users", ("id",), "workspace_name")
            ids = [row[0] for row in rows]
            if ids:
                conn.execute(
                    sa.text(
                        "UPDATE users SET workspace_name = NULL "
                        f"WHERE id IN ({', '.join(f':id{index}' for index in range(len(ids)))})"
                    ),
                    {f"id{index}": value for index, value in enumerate(ids)},
                )


def downgrade() -> None:
    # Data normalisation: writing the retired name back would break the rename
    # for every deployment that has since chosen a name, and leaving the rows is
    # harmless.
    pass
