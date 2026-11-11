"""Unit tests for the external notification dispatcher.

The dispatcher is what turns a stored per-account channel config into outbound
LINE / Telegram / webhook requests. It had no direct tests: the approval-email
suite covers a different path, so every branch here (channel selection, SSRF
refusal, transport errors, per-event opt-out) was unverified.
"""

import json

import pytest

from app.core.url_safety import UnsafeURLError
from app.services import notification_dispatcher as dispatcher


class FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


class RecordingClient:
    """Minimal httpx.AsyncClient stand-in that records every POST."""

    def __init__(self, status_code: int = 200, raise_exc: Exception | None = None) -> None:
        self.status_code = status_code
        self.raise_exc = raise_exc
        self.calls: list[dict] = []

    async def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if self.raise_exc is not None:
            raise self.raise_exc
        return FakeResponse(self.status_code)


def public_url_passthrough(monkeypatch):
    """Replace the DNS-resolving SSRF check with an identity function."""

    async def _allow(url: str) -> str:
        return url

    monkeypatch.setattr(dispatcher, "ensure_public_http_url", _allow)


async def test_line_webhook_posts_the_message_as_json(monkeypatch):
    public_url_passthrough(monkeypatch)
    client = RecordingClient(status_code=200)

    sent = await dispatcher.send_to_channel(
        client, "line", {"line_webhook_url": "https://hook.example/line"}, "hello"
    )

    assert sent is True
    assert client.calls[0]["url"] == "https://hook.example/line"
    assert client.calls[0]["json"] == {"message": "hello"}


async def test_line_token_uses_the_notify_api(monkeypatch):
    client = RecordingClient(status_code=204)

    sent = await dispatcher.send_to_channel(client, "line", {"line_token": "tok-123"}, "hi")

    assert sent is True
    call = client.calls[0]
    assert call["url"] == "https://notify-api.line.me/api/notify"
    assert call["headers"] == {"Authorization": "Bearer tok-123"}
    assert call["data"] == {"message": "hi"}


async def test_a_refused_target_is_never_contacted(monkeypatch):
    async def _refuse(url: str) -> str:
        raise UnsafeURLError("resolves to a private address")

    monkeypatch.setattr(dispatcher, "ensure_public_http_url", _refuse)
    client = RecordingClient()

    sent = await dispatcher.send_to_channel(
        client, "webhook", {"webhook_url": "https://internal.example/hook"}, "hi"
    )

    assert sent is False
    assert client.calls == []


async def test_telegram_requires_both_token_and_chat_id():
    client = RecordingClient()
    assert await dispatcher.send_to_channel(client, "telegram", {"telegram_bot_token": "t"}, "x") is False

    sent = await dispatcher.send_to_channel(
        client,
        "telegram",
        {"telegram_bot_token": "t", "telegram_chat_id": "42"},
        "x",
    )

    assert sent is True
    assert client.calls[0]["url"] == "https://api.telegram.org/bott/sendMessage"
    assert client.calls[0]["json"] == {"chat_id": "42", "text": "x"}


async def test_webhook_carries_every_payload_key_the_receivers_expect(monkeypatch):
    public_url_passthrough(monkeypatch)
    client = RecordingClient(status_code=200)

    sent = await dispatcher.send_to_channel(
        client, "webhook", {"webhook_url": "https://hook.example/x"}, "msg"
    )

    assert sent is True
    body = client.calls[0]["json"]
    assert body == {
        "content": "msg",
        "text": "msg",
        "message": "msg",
        "source": "ART Workspace",
    }


@pytest.mark.parametrize("status_code", [400, 401, 500])
async def test_a_non_success_status_is_reported_as_not_sent(monkeypatch, status_code):
    public_url_passthrough(monkeypatch)
    client = RecordingClient(status_code=status_code)

    assert await dispatcher.send_to_channel(
        client, "webhook", {"webhook_url": "https://hook.example/x"}, "msg"
    ) is False


async def test_a_transport_error_is_swallowed(monkeypatch):
    public_url_passthrough(monkeypatch)
    client = RecordingClient(raise_exc=RuntimeError("connection reset"))

    assert await dispatcher.send_to_channel(
        client, "webhook", {"webhook_url": "https://hook.example/x"}, "msg"
    ) is False


async def test_an_unconfigured_or_unknown_channel_sends_nothing():
    client = RecordingClient()

    assert await dispatcher.send_to_channel(client, "line", {}, "msg") is False
    assert await dispatcher.send_to_channel(client, "carrier-pigeon", {"x": 1}, "msg") is False
    assert client.calls == []


async def test_a_user_who_opted_out_of_the_event_sends_nothing(monkeypatch):
    public_url_passthrough(monkeypatch)
    client = RecordingClient()
    config = {"webhook_url": "https://hook.example/x", "events": {"oil_alert": False}}

    sent = await dispatcher._dispatch_to_user(client, config, "oil_alert", "msg")

    assert sent == 0
    assert client.calls == []


async def test_every_configured_channel_counts_once(monkeypatch):
    public_url_passthrough(monkeypatch)
    client = RecordingClient(status_code=200)
    config = {
        "line_token": "tok",
        "telegram_bot_token": "t",
        "telegram_chat_id": "1",
        "webhook_url": "https://hook.example/x",
    }

    sent = await dispatcher._dispatch_to_user(client, config, "daily_digest", "msg")

    assert sent == 3
    assert len(client.calls) == 3


async def test_dispatch_event_notifications_skips_broken_configs_and_counts_sends(
    monkeypatch, make_user, db_session
):
    public_url_passthrough(monkeypatch)
    client = RecordingClient(status_code=200)

    await make_user(
        email="subscribed@example.com",
        external_notifications=json.dumps({"webhook_url": "https://hook.example/a"}),
    )
    await make_user(email="broken@example.com", external_notifications="{not json")
    await make_user(email="silent@example.com", external_notifications=None)

    class _ClientFactory:
        def __init__(self, *args, **kwargs):
            self.kwargs = kwargs

        async def __aenter__(self):
            return client

        async def __aexit__(self, *exc_info):
            return False

    monkeypatch.setattr(dispatcher.httpx, "AsyncClient", _ClientFactory)

    sent = await dispatcher.dispatch_event_notifications(db_session, "daily_digest", "msg")

    assert sent == 1
    assert len(client.calls) == 1
    # Redirects stay off so an allowed host cannot bounce the request inward.
    assert client.calls[0]["url"] == "https://hook.example/a"


async def test_dispatch_event_notifications_with_no_subscribers_returns_zero(
    monkeypatch, db_session
):
    class _ClientFactory:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return RecordingClient()

        async def __aexit__(self, *exc_info):
            return False

    monkeypatch.setattr(dispatcher.httpx, "AsyncClient", _ClientFactory)

    assert await dispatcher.dispatch_event_notifications(db_session, "daily_digest", "msg") == 0
