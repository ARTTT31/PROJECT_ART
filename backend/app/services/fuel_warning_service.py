"""Fuel Price Change Early Warning Service.

Checks Bangchak Open API for tomorrow's retail fuel price changes (usually announced
around 17:00-18:00) and dispatches Web Push notifications and external alerts to users.
Includes de-duplication to prevent sending multiple alerts on the same calendar day.
"""

import datetime
import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.oil_prices import BANGCHAK_OIL_URL
from app.models.notification_log import NotificationLog
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.notification_dispatcher import send_to_channel
from app.services.web_push_service import send_web_push_to_user

logger = logging.getLogger(__name__)

LAST_WARNING_SETTING_KEY = "last_fuel_warning_date"


def parse_bangchak_tomorrow_changes(raw_data: Any) -> List[Dict[str, Any]]:
    """Parse Bangchak API JSON response and extract tomorrow's price changes."""
    if not raw_data or not isinstance(raw_data, list):
        return []

    first = raw_data[0]
    raw_list = first.get("OilList", [])
    if isinstance(raw_list, str):
        try:
            raw_list = json.loads(raw_list)
        except Exception:
            raw_list = []

    changes: List[Dict[str, Any]] = []
    for item in raw_list:
        name = item.get("OilName", "").strip()
        price_today = item.get("PriceToday")
        price_tomorrow = item.get("PriceTomorrow")

        if price_today is not None and price_tomorrow is not None:
            try:
                p_today = float(price_today)
                p_tomorrow = float(price_tomorrow)
                diff = round(p_tomorrow - p_today, 2)
                if diff != 0:
                    changes.append({
                        "name": name,
                        "today": p_today,
                        "tomorrow": p_tomorrow,
                        "diff": diff,
                    })
            except (ValueError, TypeError):
                continue

    return changes


async def check_fuel_price_changes() -> List[Dict[str, Any]]:
    """Fetch live data from Bangchak API and check tomorrow's changes."""
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            res = await client.get(
                BANGCHAK_OIL_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            if res.status_code == 200:
                payload = res.json()
                return parse_bangchak_tomorrow_changes(payload)
    except Exception as exc:
        logger.warning("Failed to fetch Bangchak tomorrow prices: %s", exc)

    return []


async def dispatch_fuel_warning_if_changed(
    db: AsyncSession,
    mock_changes: Optional[List[Dict[str, Any]]] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """Check and dispatch early fuel warnings if price changes are detected.

    Args:
        db: Async database session.
        mock_changes: Optional injected list of changes (for testing).
        force: If True, bypasses same-day de-duplication check.

    Returns:
        Summary dict of the operation.
    """
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # 1. De-duplication check
    if not force:
        setting = await db.get(SystemSetting, LAST_WARNING_SETTING_KEY)
        if setting and setting.value == today_str:
            return {
                "sent": False,
                "reason": f"Already notified today ({today_str})",
                "changes": [],
            }

    # 2. Check for changes
    changes = mock_changes if mock_changes is not None else await check_fuel_price_changes()
    if not changes:
        return {
            "sent": False,
            "reason": "No price changes announced for tomorrow",
            "changes": [],
        }

    # Filter increases vs decreases
    increases = [c for c in changes if c["diff"] > 0]
    decreases = [c for c in changes if c["diff"] < 0]

    if increases:
        max_inc = max(c["diff"] for c in increases)
        sample_names = ", ".join(c["name"] for c in increases[:2])
        title = "⚠️ ราคาน้ำมันจะปรับขึ้นพรุ่งนี้"
        body = (
            f"พรุ่งนี้ราคาน้ำมันปรับขึ้นสูงสุด +{max_inc:.2f} บาท/ลิตร ({sample_names}) "
            "แนะนำแวะเติมน้ำมันก่อนกลับบ้านครับ"
        )
    elif decreases:
        max_dec = abs(min(c["diff"] for c in decreases))
        sample_names = ", ".join(c["name"] for c in decreases[:2])
        title = "🎉 ราคาน้ำมันจะปรับลดลงพรุ่งนี้"
        body = (
            f"พรุ่งนี้ราคาน้ำมันปรับลดลงสูงสุด -{max_dec:.2f} บาท/ลิตร ({sample_names}) "
            "อดใจรอเติมพรุ่งนี้เพื่อความประหยัดครับ"
        )
    else:
        return {"sent": False, "reason": "No net price difference", "changes": []}

    # 3. Find active users and dispatch
    stmt = select(User).where(User.is_active.is_(True))
    result = await db.execute(stmt)
    users = result.scalars().all()

    web_push_count = 0
    external_count = 0

    async with httpx.AsyncClient(timeout=10.0) as http_client:
        for user in users:
            # A) Web Push
            try:
                sent = await send_web_push_to_user(
                    db=db,
                    user=user,
                    title=title,
                    body=body,
                    url="/dashboard?action=oil-prices",
                )
                if sent:
                    web_push_count += 1
            except Exception:
                pass

            # B) External Channels (LINE / Telegram / Webhook)
            if user.external_notifications:
                try:
                    config = json.loads(user.external_notifications)
                    events = config.get("events") or {}
                    # The settings API stores this switch as ``oil_alert``;
                    # reading ``oil_prices`` here silently ignored the toggle.
                    if events.get("oil_alert", True):
                        msg = f"{title}\n{body}"
                        if config.get("line_token") or config.get("line_webhook_url"):
                            if await send_to_channel(http_client, "line", config, msg):
                                external_count += 1
                        if config.get("telegram_bot_token") and config.get("telegram_chat_id"):
                            if await send_to_channel(http_client, "telegram", config, msg):
                                external_count += 1
                        if config.get("webhook_url"):
                            if await send_to_channel(http_client, "webhook", config, msg):
                                external_count += 1
                except Exception:
                    pass

            # C) Notification History Log (Idempotent & safe against duplicate key conflicts)
            now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
            client_id = f"fuel-warn-{today_str}-{int(now_utc.timestamp())}-{user.id}"
            try:
                log_stmt = select(NotificationLog).where(
                    NotificationLog.user_id == user.id,
                    NotificationLog.client_id == client_id,
                )
                log_res = await db.execute(log_stmt)
                existing_log = log_res.scalar_one_or_none()
                if existing_log:
                    existing_log.title = title
                    existing_log.body = body
                    existing_log.occurred_at = now_utc
                    existing_log.read_at = None
                else:
                    log_entry = NotificationLog(
                        user_id=user.id,
                        client_id=client_id,
                        type="oilprice",
                        level="warning" if increases else "info",
                        title=title,
                        body=body,
                        occurred_at=now_utc,
                        read_at=None,
                    )
                    db.add(log_entry)
            except Exception:
                pass

    # 4. Record last sent date for de-duplication
    try:
        setting = await db.get(SystemSetting, LAST_WARNING_SETTING_KEY)
        if not setting:
            setting = SystemSetting(key=LAST_WARNING_SETTING_KEY, value=today_str)
            db.add(setting)
        else:
            setting.value = today_str

        await db.commit()
    except Exception as exc:
        logger.warning("Failed to commit fuel warning record: %s", exc)
        await db.rollback()

    return {
        "sent": True,
        "date": today_str,
        "title": title,
        "body": body,
        "web_push_count": web_push_count,
        "external_count": external_count,
        "changes": changes,
    }
