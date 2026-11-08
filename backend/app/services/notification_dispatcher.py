"""Automated External Notification Dispatcher.

Dispatches scheduled notifications (oil price alerts, market summaries, daily digests)
to users who have configured external notifications (LINE, Telegram, Webhook).
"""

import json
import logging
from typing import Any, Dict
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)


async def send_to_channel(
    client: httpx.AsyncClient,
    channel: str,
    target_config: Dict[str, Any],
    message: str,
) -> bool:
    """Send a notification message to a specific channel (line, telegram, webhook)."""
    try:
        if channel == "line":
            token = (target_config.get("line_token") or "").strip()
            webhook = (target_config.get("line_webhook_url") or "").strip()
            url = webhook if webhook.startswith("http") else token
            if url and url.startswith("http"):
                res = await client.post(url, json={"message": message})
                return res.status_code in (200, 204)
            elif token:
                res = await client.post(
                    "https://notify-api.line.me/api/notify",
                    headers={"Authorization": f"Bearer {token}"},
                    data={"message": message},
                )
                return res.status_code in (200, 204)

        elif channel == "telegram":
            bot_token = (target_config.get("telegram_bot_token") or "").strip()
            chat_id = (target_config.get("telegram_chat_id") or "").strip()
            if bot_token and chat_id:
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                res = await client.post(url, json={"chat_id": chat_id, "text": message})
                return res.status_code in (200, 204)

        elif channel == "webhook":
            webhook_url = (target_config.get("webhook_url") or "").strip()
            if webhook_url and webhook_url.startswith("http"):
                res = await client.post(
                    webhook_url,
                    json={
                        "content": message,
                        "text": message,
                        "message": message,
                        "source": "ART Workspace",
                    },
                )
                return res.status_code in (200, 204)

    except Exception as exc:
        logger.warning("Failed to send %s notification: %s", channel, exc)

    return False


async def dispatch_event_notifications(
    db: AsyncSession,
    event_type: str,
    message: str,
) -> int:
    """Find all active users subscribed to event_type and dispatch to their channels.

    Returns the number of successful dispatches.
    """
    stmt = select(User).where(User.is_active.is_(True), User.external_notifications.is_not(None))
    result = await db.execute(stmt)
    users = result.scalars().all()

    success_count = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for user in users:
            try:
                config = json.loads(user.external_notifications or "{}")
            except Exception:
                continue

            events = config.get("events") or {}
            # Check subscription
            if not events.get(event_type, True):
                continue

            # Dispatch to each configured channel
            if config.get("line_token") or config.get("line_webhook_url"):
                if await send_to_channel(client, "line", config, message):
                    success_count += 1

            if config.get("telegram_bot_token") and config.get("telegram_chat_id"):
                if await send_to_channel(client, "telegram", config, message):
                    success_count += 1

            if config.get("webhook_url"):
                if await send_to_channel(client, "webhook", config, message):
                    success_count += 1

    return success_count
