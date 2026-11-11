"""Tests for the UserService writers that replace one profile JSON column.

These writers are the only way a blob reaches the database, and
``update_quick_links`` is the one place the quick-link sanitiser is applied for
both entry points (the dedicated endpoint and ``PUT /profile/me``). None of the
simple writers had a direct test.
"""

import json

import pytest

from app.services.user_service import UserService


async def test_update_quick_links_sanitises_and_returns_what_it_stored(make_user, db_session):
    user = await make_user(email="links@example.com")
    service = UserService(db_session)
    raw = json.dumps(
        [
            {"id": "a", "label": "OK", "url": "https://example.com/a", "icon": "link"},
            {"id": "b", "label": "Bad scheme", "url": "javascript:alert(1)", "icon": "link"},
            {"id": "a", "label": "Duplicate id", "url": "https://example.com/dup", "icon": "link"},
            {"id": "c", "label": "Relative", "url": "/dashboard", "icon": "home", "color": "#fff"},
            "not-a-dict",
        ]
    )

    cleaned = await service.update_quick_links(user.id, raw)

    assert [entry["id"] for entry in cleaned] == ["a", "c"]
    stored = json.loads(user.quick_links)
    assert stored == cleaned
    assert stored[1]["color"] == "#fff"


async def test_update_quick_links_rejects_an_unknown_account(db_session):
    with pytest.raises(ValueError):
        await UserService(db_session).update_quick_links(999_999, "[]")


@pytest.mark.parametrize(
    ("writer", "column", "value"),
    [
        ("update_main_menu", "main_menu", json.dumps({"order": ["dashboard", "profile"]})),
        ("update_dashboard_layout", "dashboard_layout", json.dumps({"order": ["notes"]})),
        ("update_camera_config", "camera_config", json.dumps({"streams": []})),
        ("update_avatar", "avatar", "data:image/webp;base64,AAAA"),
    ],
)
async def test_each_blob_writer_stores_its_column(make_user, db_session, writer, column, value):
    user = await make_user(email=f"{writer}@example.com")

    await getattr(UserService(db_session), writer)(user.id, value)

    assert getattr(user, column) == value


@pytest.mark.parametrize(
    "writer",
    ["update_main_menu", "update_dashboard_layout", "update_camera_config"],
)
async def test_blob_writers_reject_an_unknown_account(db_session, writer):
    with pytest.raises(ValueError):
        await getattr(UserService(db_session), writer)(999_999, "{}")


async def test_delete_user_reports_a_missing_account_instead_of_raising(db_session):
    assert await UserService(db_session).delete_user(999_999) is False
