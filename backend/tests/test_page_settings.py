"""Tests for workspace page settings and registration policy helpers."""
import pytest
from app.core.page_settings import (
    default_enabled_pages,
    normalise_enabled_pages,
    serialize_enabled_pages,
    get_enabled_pages,
    LOCKED_PAGE_IDS,
    PAGE_IDS,
    SETTING_KEY,
)
from app.models.system_setting import SystemSetting
from app.services.registration_policy import get_effective_registration_mode


def test_default_enabled_pages():
    pages = default_enabled_pages()
    assert set(pages) == set(PAGE_IDS)


def test_normalise_enabled_pages_none():
    assert normalise_enabled_pages(None) == list(PAGE_IDS)


def test_normalise_enabled_pages_invalid_json():
    assert normalise_enabled_pages("not-json") == list(PAGE_IDS)
    assert normalise_enabled_pages("123") == list(PAGE_IDS)


def test_normalise_enabled_pages_filters_unknown_and_keeps_locked():
    # Only camera enabled, but locked pages (dashboard, profile, admin, audit) must be kept
    raw = '["camera", "unknown_page"]'
    normalised = normalise_enabled_pages(raw)
    assert "camera" in normalised
    assert "unknown_page" not in normalised
    for locked in LOCKED_PAGE_IDS:
        assert locked in normalised


def test_serialize_enabled_pages():
    serialized = serialize_enabled_pages(["camera"])
    normalised = normalise_enabled_pages(serialized)
    assert "camera" in normalised
    for locked in LOCKED_PAGE_IDS:
        assert locked in normalised


@pytest.mark.asyncio
async def test_get_enabled_pages_from_db(db_session):
    # When no setting exists in DB
    pages = await get_enabled_pages(db_session)
    assert set(pages) == set(PAGE_IDS)

    # When setting exists in DB with camera disabled
    setting = SystemSetting(
        key=SETTING_KEY,
        value=serialize_enabled_pages(["dashboard", "profile"]),
    )
    db_session.add(setting)
    await db_session.commit()

    pages = await get_enabled_pages(db_session)
    assert "dashboard" in pages
    assert "profile" in pages
    assert "camera" not in pages


@pytest.mark.asyncio
async def test_get_effective_registration_mode_db(db_session):
    setting = SystemSetting(key="registration_mode", value="approval")
    db_session.add(setting)
    await db_session.commit()

    mode = await get_effective_registration_mode(db_session)
    assert mode == "approval"
