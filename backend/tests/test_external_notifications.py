import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_get_external_notifications_default(client: AsyncClient, logged_in_user):
    resp = await client.get("/api/v1/profile/external-notifications")
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["result"] == "success"
    data = res_json["data"]
    assert data["line_token"] == ""
    assert data["telegram_bot_token"] == ""
    assert data["webhook_url"] == ""
    assert data["events"]["oil_alert"] is True
    assert data["events"]["daily_summary"] is True


async def test_patch_external_notifications(client: AsyncClient, logged_in_user):
    payload = {
        "line_token": "line-token-123",
        "line_webhook_url": "https://api.line.me/test",
        "telegram_bot_token": "123:ABC",
        "telegram_chat_id": "999",
        "webhook_url": "https://example.com/webhook",
        "events": {
            "oil_alert": False,
            "market_alert": True,
            "daily_summary": True,
        },
    }
    resp = await client.patch("/api/v1/profile/external-notifications", json=payload)
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["result"] == "success"
    updated = res_json["data"]
    assert updated["line_token"] == "line-token-123"
    assert updated["telegram_bot_token"] == "123:ABC"
    assert updated["events"]["oil_alert"] is False
    assert updated["events"]["market_alert"] is True

    # Check persistence via GET
    get_resp = await client.get("/api/v1/profile/external-notifications")
    assert get_resp.status_code == 200
    get_data = get_resp.json()["data"]
    assert get_data["line_token"] == "line-token-123"
    assert get_data["telegram_chat_id"] == "999"
    assert get_data["events"]["oil_alert"] is False


async def test_notification_test_endpoint_unconfigured(client: AsyncClient, logged_in_user):
    # Test line when no token is configured -> raises 400
    resp = await client.post(
        "/api/v1/profile/external-notifications/test",
        json={"channel": "line"},
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert "ไม่ได้ระบุ" in detail or "Token" in detail
