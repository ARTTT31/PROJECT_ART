"""Add per-user sidebar menu config

The menu order and page visibility used to live only in localStorage, so a
layout arranged on one browser never reached the same account on another
device. This column stores that JSON per user.

Revision ID: 20261029_user_main_menu
Revises: 20261029_finance_watchlist
Create Date: 2026-10-29 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261029_user_main_menu"
down_revision: Union[str, None] = "20261029_finance_watchlist"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("main_menu", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("main_menu")
