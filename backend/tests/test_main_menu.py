"""The sidebar menu config is stored per account, not in the browser.

Arranging (or hiding) pages used to be localStorage-only, so the layout never
reached the same person's other device. These tests cover the endpoint that
fixes that and the session payloads the sidebar reads on load.
"""

import pytest


async def _csrf_header(client) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    return {"X-CSRF-Token": token}


@pytest.mark.asyncio
async def test_updating_the_menu_requires_auth(client):
    assert (
        await client.post("/api/v1/profile/main-menu", json={"main_menu": "[]"})
    ).status_code == 401


@pytest.mark.asyncio
async def test_saved_menu_is_returned_by_the_session(client, logged_in_user):
    csrf = await _csrf_header(client)
    saved = '[{"id":"profile","enabled":true},{"id":"dashboard","enabled":true}]'

    response = await client.post(
        "/api/v1/profile/main-menu", json={"main_menu": saved}, headers=csrf
    )
    assert response.status_code == 200, response.text

    session = (await client.get("/api/v1/auth/session")).json()
    assert session["data"]["user"]["main_menu"] == saved


@pytest.mark.asyncio
async def test_menu_is_replaced_not_appended(client, logged_in_user):
    csrf = await _csrf_header(client)

    await client.post(
        "/api/v1/profile/main-menu", json={"main_menu": "[]"}, headers=csrf
    )
    await client.post(
        "/api/v1/profile/main-menu",
        json={"main_menu": '[{"id":"dashboard","enabled":true}]'},
        headers=csrf,
    )

    session = (await client.get("/api/v1/auth/session")).json()
    assert session["data"]["user"]["main_menu"] == '[{"id":"dashboard","enabled":true}]'


@pytest.mark.asyncio
async def test_a_new_account_has_no_saved_menu(client, logged_in_user):
    """NULL means "never configured" — the app then falls back to its defaults."""
    session = (await client.get("/api/v1/auth/session")).json()
    assert session["data"]["user"]["main_menu"] is None


@pytest.mark.asyncio
async def test_oversized_payload_is_rejected(client, logged_in_user):
    csrf = await _csrf_header(client)

    response = await client.post(
        "/api/v1/profile/main-menu",
        json={"main_menu": "x" * 20_001},
        headers=csrf,
    )
    assert response.status_code == 422
