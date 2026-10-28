"""Tests for the dashboard quick-notes endpoints (/profile/quick-notes)."""

import pytest

from app.models.user import User


async def _csrf_header(client) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    return {"X-CSRF-Token": token}


@pytest.mark.asyncio
async def test_quick_notes_requires_auth(client):
    assert (await client.get("/api/v1/profile/quick-notes")).status_code == 401
    # CSRF runs before authentication for mutations, so either code is a refusal.
    assert (
        await client.put("/api/v1/profile/quick-notes", json={"notes": []})
    ).status_code in (401, 403)


@pytest.mark.asyncio
async def test_new_account_starts_with_an_empty_list(client, logged_in_user):
    response = await client.get("/api/v1/profile/quick-notes")
    assert response.status_code == 200
    assert response.json()["notes"] == []


@pytest.mark.asyncio
async def test_saving_and_reading_back_the_list(client, logged_in_user):
    csrf = await _csrf_header(client)
    notes = [
        {"id": "n1", "text": "เช็คสต็อกหน้าร้าน", "done": False},
        {"id": "n2", "text": "โทรหาลูกค้า", "done": True},
    ]

    saved = await client.put(
        "/api/v1/profile/quick-notes", json={"notes": notes}, headers=csrf
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["notes"] == notes

    fetched = await client.get("/api/v1/profile/quick-notes")
    assert fetched.json()["notes"] == notes


@pytest.mark.asyncio
async def test_saving_replaces_the_previous_list(client, logged_in_user):
    csrf = await _csrf_header(client)
    await client.put(
        "/api/v1/profile/quick-notes",
        json={"notes": [{"id": "old", "text": "รายการเก่า", "done": False}]},
        headers=csrf,
    )

    replaced = await client.put(
        "/api/v1/profile/quick-notes",
        json={"notes": [{"id": "new", "text": "รายการใหม่", "done": False}]},
        headers=csrf,
    )
    assert [note["id"] for note in replaced.json()["notes"]] == ["new"]


@pytest.mark.asyncio
async def test_text_longer_than_the_cap_is_rejected(client, logged_in_user):
    csrf = await _csrf_header(client)
    too_long = await client.put(
        "/api/v1/profile/quick-notes",
        json={"notes": [{"id": "n1", "text": "ก" * 201, "done": False}]},
        headers=csrf,
    )
    assert too_long.status_code == 422


@pytest.mark.asyncio
async def test_more_than_fifty_notes_is_rejected(client, logged_in_user):
    csrf = await _csrf_header(client)
    notes = [{"id": f"n{i}", "text": f"งาน {i}", "done": False} for i in range(51)]

    response = await client.put(
        "/api/v1/profile/quick-notes", json={"notes": notes}, headers=csrf
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_a_corrupt_stored_value_reads_as_an_empty_list(
    client, logged_in_user, registered_user, db_session
):
    """A hand-edited (or legacy) column must not 500 the widget."""
    user_id = registered_user["data"]["user_id"]
    user = await db_session.get(User, user_id)
    user.quick_notes = "{not valid json"
    await db_session.commit()

    response = await client.get("/api/v1/profile/quick-notes")
    assert response.status_code == 200
    assert response.json()["notes"] == []


@pytest.mark.asyncio
async def test_notes_are_per_account(client, make_user, logged_in_user):
    from tests.conftest import TEST_USER_PASSWORD, _login

    csrf = await _csrf_header(client)
    await client.put(
        "/api/v1/profile/quick-notes",
        json={"notes": [{"id": "mine", "text": "ของฉัน", "done": False}]},
        headers=csrf,
    )

    # A second account on the same server sees its own (empty) list.
    await make_user(email="other@example.com", name="Other")
    other_client_token = await _login(client, "other@example.com", TEST_USER_PASSWORD)
    assert other_client_token["result"] == "success"

    response = await client.get("/api/v1/profile/quick-notes")
    assert response.json()["notes"] == []
