import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from pywebpush import WebPushException

from app.models.user import User
from app.services.web_push_service import (
    get_vapid_public_key,
    get_vapid_private_key,
    send_web_push,
    send_web_push_to_user,
)


def test_get_vapid_public_key_format():
    key = get_vapid_public_key()
    assert isinstance(key, str)
    # URL-safe uncompressed P-256 base64 point is 87 characters long
    assert len(key) == 87
    # Starts with uncompressed point prefix byte 0x04, which is 'B' in base64
    assert key.startswith("B")


def test_get_vapid_private_key():
    key = get_vapid_private_key()
    assert key is not None


@pytest.mark.asyncio
async def test_send_web_push_skips_simulated_endpoint():
    sub = {"endpoint": "browser-native-notification", "keys": {"p256dh": "a", "auth": "b"}}
    res = await send_web_push(sub, {"title": "Test", "body": "Hello"})
    assert res is False


@pytest.mark.asyncio
async def test_send_web_push_success():
    sub = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/fake-token",
        "keys": {"p256dh": "fake-p256dh", "auth": "fake-auth"},
    }
    with patch("app.services.web_push_service.webpush_async", new_callable=AsyncMock) as mock_push:
        mock_push.return_value = MagicMock(status_code=201)
        res = await send_web_push(sub, {"title": "Test", "body": "Hello"})
        assert res is True
        mock_push.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_web_push_to_user_prunes_410_gone():
    user = User(
        id=999,
        username="pushtest",
        email="push@example.com",
        web_push_subscription=json.dumps({
            "endpoint": "https://updates.push.services.mozilla.com/wpush/v2/expired",
            "keys": {"p256dh": "d", "auth": "a"},
        }),
    )

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    fake_response = MagicMock(status_code=410)
    exc = WebPushException("Subscription has expired", response=fake_response)

    with patch("app.services.web_push_service.webpush_async", side_effect=exc):
        res = await send_web_push_to_user(mock_db, user, "Test", "Body")
        assert res is False
        # Verify expired subscription was cleared
        assert user.web_push_subscription is None
        mock_db.add.assert_called_with(user)
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_web_push_to_user_without_subscription():
    user = User(id=998, username="nosub", email="nosub@example.com", web_push_subscription=None)
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    res = await send_web_push_to_user(mock_db, user, "Test", "Body")
    assert res is False
