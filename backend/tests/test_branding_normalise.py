"""The retired product name must not survive in branding reads or the database.

The workspace is nameable now, but rows seeded under the old product name (the
workspace-wide name, and accounts that copied it into their own override) kept
showing it. Reads normalise them; ``20261119_normalise_branding`` rewrites them.
"""

import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import op

from app.core.branding import (
    DEFAULT_COMPANY_NAME,
    is_legacy_company_name,
    normalise_company_name,
    normalise_personal_workspace_name,
)

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20261119_1000_normalise_legacy_branding.py"
)


def test_legacy_name_is_detected_regardless_of_case_and_padding():
    for value in ("ART Workspace", " art workspace ", "Art Workspace"):
        assert is_legacy_company_name(value) is True
    for value in ("", None, "Workspace", "ทีมของฉัน"):
        assert is_legacy_company_name(value) is False


def test_workspace_name_falls_back_to_the_neutral_default():
    assert normalise_company_name("ART Workspace") == DEFAULT_COMPANY_NAME
    assert normalise_company_name("   ") == DEFAULT_COMPANY_NAME
    assert normalise_company_name(None) == DEFAULT_COMPANY_NAME
    assert normalise_company_name("ทีมของฉัน") == "ทีมของฉัน"


def test_legacy_personal_override_means_no_override():
    assert normalise_personal_workspace_name("ART Workspace") == ""
    assert normalise_personal_workspace_name("") == ""
    assert normalise_personal_workspace_name("ทีมของฉัน") == "ทีมของฉัน"


@pytest.mark.asyncio
async def test_stored_legacy_name_is_served_as_the_new_default(
    client, logged_in_admin_user
):
    """A database row written under the old name must not reach the UI."""
    csrf = {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}
    if not csrf["X-CSRF-Token"]:
        csrf = {
            "X-CSRF-Token": (await client.get("/api/v1/auth/csrf")).json()["data"][
                "csrf_token"
            ]
        }

    saved = await client.put(
        "/api/v1/system/branding",
        json={"company_name": "ART Workspace"},
        headers=csrf,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["company_name"] == DEFAULT_COMPANY_NAME

    public = await client.get("/api/v1/system/branding")
    assert public.json()["company_name"] == DEFAULT_COMPANY_NAME


@pytest.mark.asyncio
async def test_legacy_personal_override_is_served_as_following_the_workspace(
    client, logged_in_user
):
    csrf = {
        "X-CSRF-Token": (await client.get("/api/v1/auth/csrf")).json()["data"][
            "csrf_token"
        ]
    }
    saved = await client.put(
        "/api/v1/profile/workspace-branding",
        json={"workspace_name": "ART Workspace"},
        headers=csrf,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["workspace_name"] == ""

    fetched = await client.get("/api/v1/profile/workspace-branding")
    assert fetched.json()["workspace_name"] == ""


def _load_migration():
    spec = importlib.util.spec_from_file_location("normalise_branding_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_migration_rewrites_legacy_branding_rows(monkeypatch):
    """The stored value is rewritten and legacy personal overrides are cleared."""
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE system_settings (key VARCHAR(100) PRIMARY KEY, "
                "value TEXT, description VARCHAR(255), created_at DATETIME, updated_at DATETIME)"
            )
        )
        conn.execute(
            sa.text(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, workspace_name VARCHAR(100))"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO system_settings (key, value, description) VALUES "
                "('company_name', 'ART Workspace', 'ชื่อ'), "
                "('company_tagline', 'ART Workspace', 'keep me')"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO users (id, workspace_name) VALUES "
                "(1, 'ART Workspace'), (2, 'ทีมของฉัน'), (3, NULL)"
            )
        )

        monkeypatch.setattr(op, "get_bind", lambda: conn)
        _load_migration().upgrade()

        assert (
            conn.execute(
                sa.text("SELECT value FROM system_settings WHERE key = 'company_name'")
            ).scalar_one()
            == DEFAULT_COMPANY_NAME
        )
        # Only the name row is normalised; other rows are left alone.
        assert (
            conn.execute(
                sa.text("SELECT value FROM system_settings WHERE key = 'company_tagline'")
            ).scalar_one()
            == "ART Workspace"
        )
        assert conn.execute(
            sa.text("SELECT workspace_name FROM users WHERE id = 1")
        ).scalar_one() is None
        assert (
            conn.execute(
                sa.text("SELECT workspace_name FROM users WHERE id = 2")
            ).scalar_one()
            == "ทีมของฉัน"
        )
        assert (
            conn.execute(
                sa.text("SELECT workspace_name FROM users WHERE id = 3")
            ).scalar_one()
            is None
        )


def test_migration_is_idempotent(monkeypatch):
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE system_settings (key VARCHAR(100) PRIMARY KEY, "
                "value TEXT, description VARCHAR(255), created_at DATETIME, updated_at DATETIME)"
            )
        )
        conn.execute(
            sa.text("INSERT INTO system_settings (key, value) VALUES ('company_name', 'TV Space')")
        )

        monkeypatch.setattr(op, "get_bind", lambda: conn)
        migration = _load_migration()
        migration.upgrade()
        migration.upgrade()

        # A name an admin actually chose is never overwritten.
        assert (
            conn.execute(
                sa.text("SELECT value FROM system_settings WHERE key = 'company_name'")
            ).scalar_one()
            == "TV Space"
        )
