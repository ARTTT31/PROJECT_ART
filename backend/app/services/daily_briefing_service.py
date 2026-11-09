"""Daily Briefing Service.

Gathers customizable topics (fuel prices, weather/PM2.5, market summary, pending tasks,
holidays) and dispatches automated morning push briefings to users.
"""

import datetime
import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_holidays import SETTING_KEY as HOLIDAY_SETTING_KEY, parse_company_calendar
from app.models.notification_log import NotificationLog
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services import weather_cache
from app.services.notification_dispatcher import send_to_channel
from app.services.web_push_service import send_web_push_to_user

logger = logging.getLogger(__name__)

DEFAULT_TOPICS: Dict[str, bool] = {
    "oil_prices": True,
    "weather": True,
    "market": True,
    "tasks": True,
    "holidays": True,
}

DEFAULT_BRIEFING_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "time": "07:30",
    "topics": DEFAULT_TOPICS,
}


def get_user_briefing_config(user: User) -> Dict[str, Any]:
    """Retrieve briefing configuration from user JSON settings."""
    raw = getattr(user, "external_notifications", None)
    if not raw:
        return dict(DEFAULT_BRIEFING_CONFIG)
    try:
        data = json.loads(raw)
        cfg = data.get("daily_briefing")
        if isinstance(cfg, dict):
            topics: Dict[str, bool] = dict(DEFAULT_TOPICS)
            topics.update(cfg.get("topics", {}))
            return {
                "enabled": bool(cfg.get("enabled", False)),
                "time": str(cfg.get("time", "07:30")),
                "topics": topics,
            }
    except Exception:
        pass
    return dict(DEFAULT_BRIEFING_CONFIG)


def set_user_briefing_config(user: User, config: Dict[str, Any]) -> None:
    """Store briefing configuration into user JSON settings."""
    raw = getattr(user, "external_notifications", None)
    data: Dict[str, Any] = {}
    if raw:
        try:
            data = json.loads(raw)
        except Exception:
            data = {}

    data["daily_briefing"] = {
        "enabled": bool(config.get("enabled", False)),
        "time": str(config.get("time", "07:30")),
        "topics": config.get("topics", DEFAULT_BRIEFING_CONFIG["topics"]),
    }
    user.external_notifications = json.dumps(data, ensure_ascii=False)


async def _latest_oil_payload(db: AsyncSession) -> Optional[Dict[str, Any]]:
    """Last oil-price snapshot persisted by the oil-prices endpoint."""
    # Keeping the namespace/key literal here avoids importing an API module from
    # a service; they mirror NS_OIL_PRICES / _L2_KEY in endpoints/oil_prices.py.
    payload = await weather_cache.get_stale(db, "oil-prices", ("latest",))
    return payload if isinstance(payload, dict) else None


def _oil_price_line(payload: Optional[Dict[str, Any]]) -> str:
    """Format observed prices, or say plainly that none are available.

    The previous version printed a fixed "37.69 / 38.39" pair that was never
    fetched from anywhere, so every briefing carried invented numbers.
    """
    prices = (payload or {}).get("prices")
    if not isinstance(prices, list):
        return "⛽ ยังไม่มีข้อมูลราคาน้ำมันล่าสุดในระบบ"

    wanted = ("gasohol_95", "diesel")
    picked = [
        item
        for item in prices
        if isinstance(item, dict)
        and item.get("key") in wanted
        and item.get("price") is not None
    ]
    if not picked:
        return "⛽ ยังไม่มีข้อมูลราคาน้ำมันล่าสุดในระบบ"

    parts = [f"{item.get('name')}: {item.get('price')} บ." for item in picked]
    line = "⛽ ราคาน้ำมันล่าสุด " + " | ".join(parts)
    if (payload or {}).get("is_stale"):
        line += " (ข้อมูลอาจไม่ใช่ราคาปัจจุบัน)"
    return line


async def _holiday_line(db: AsyncSession) -> str:
    """Today's status from the workspace holiday calendar (if imported)."""
    setting = await db.get(SystemSetting, HOLIDAY_SETTING_KEY)
    calendar = parse_company_calendar(setting.value if setting else None)
    today = datetime.date.today()
    entries = calendar.get(today.year, [])
    if not entries:
        return "📅 ยังไม่มีปฏิทินวันหยุดบริษัทในระบบ"
    todays = [entry for entry in entries if entry.get("date") == today.isoformat()]
    if todays:
        titles = ", ".join(str(entry.get("title")) for entry in todays)
        return f"📅 วันนี้เป็นวันหยุด: {titles}"
    return "📅 วันนี้เป็นวันทำการปกติ (ตามปฏิทินบริษัท)"


async def build_briefing_content(db: AsyncSession, user: User, topics: Dict[str, bool]) -> Dict[str, str]:
    """Compile morning briefing text based on enabled topics."""
    lines: List[str] = []

    # 1. Fuel Prices — observed data from the shared cache, never constants.
    if topics.get("oil_prices"):
        lines.append(_oil_price_line(await _latest_oil_payload(db)))

    # 2. Weather & Air Quality
    #    The weather widget keeps its coordinates in the browser, so the server
    #    has no location to query. Say so instead of asserting a fake forecast.
    if topics.get("weather"):
        lines.append("🌿 สภาพอากาศ: ยังไม่มีข้อมูลสภาพอากาศล่าสุดในระบบ")

    # 3. Market & SET — no market data source is wired into this backend yet.
    if topics.get("market"):
        lines.append("📈 ตลาดการเงิน: ยังไม่มีแหล่งข้อมูลตลาดล่าสุดในระบบ")

    # 4. Pending Tasks from Quick Notes
    if topics.get("tasks"):
        pending_count = 0
        try:
            from sqlalchemy import inspect
            insp = inspect(user)
            if "quick_notes" in getattr(insp, "unloaded", set()):
                await db.refresh(user, ["quick_notes"])
            raw_notes = getattr(user, "quick_notes", None)
            if raw_notes:
                parsed_notes = json.loads(raw_notes)
                if isinstance(parsed_notes, list):
                    pending_count = len([n for n in parsed_notes if not n.get("done")])
        except Exception as exc:
            logger.debug("Failed to read quick_notes for daily briefing: %s", exc)
        if pending_count > 0:
            lines.append(f"📝 มีงานค้าง {pending_count} รายการในโน้ตด่วน")
        else:
            lines.append("✨ ไม่มีงานค้างในโน้ตด่วน พร้อมลุยวันใหม่!")

    # 5. Holidays — read the calendar an admin imported for this workspace.
    if topics.get("holidays"):
        lines.append(await _holiday_line(db))

    title = f"☀️ สรุปข้อมูลเช้านี้ ({datetime.date.today().strftime('%d/%m/%Y')})"
    body = "\n".join(lines) if lines else "ขอให้เป็นวันที่ราบรื่นและประสบความสำเร็จครับ!"
    return {"title": title, "body": body}


async def dispatch_user_briefing(db: AsyncSession, user: User, is_test: bool = False) -> Dict[str, Any]:
    """Compile and send briefing to user via Web Push and external channels."""
    config = get_user_briefing_config(user)
    topics = config.get("topics", {})
    content = await build_briefing_content(db, user, topics)

    title = content["title"]
    if is_test:
        title = f"🔔 [ทดสอบ] {title}"
    body = content["body"]

    # Web Push
    web_push_sent = False
    try:
        web_push_sent = await send_web_push_to_user(
            db=db,
            user=user,
            title=title,
            body=body,
            url="/dashboard",
        )
    except Exception as exc:
        logger.debug("Briefing web push failed: %s", exc)

    # External Channels
    external_sent = False
    if user.external_notifications:
        try:
            ext_cfg = json.loads(user.external_notifications)
            msg = f"{title}\n\n{body}"
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                if ext_cfg.get("line_token") or ext_cfg.get("line_webhook_url"):
                    if await send_to_channel(http_client, "line", ext_cfg, msg):
                        external_sent = True
                if ext_cfg.get("telegram_bot_token") and ext_cfg.get("telegram_chat_id"):
                    if await send_to_channel(http_client, "telegram", ext_cfg, msg):
                        external_sent = True
                if ext_cfg.get("webhook_url"):
                    if await send_to_channel(http_client, "webhook", ext_cfg, msg):
                        external_sent = True
        except Exception:
            pass

    # History Log (idempotent & safe against duplicate key conflicts)
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    prefix = "briefing-test" if is_test else "briefing"
    client_id = f"{prefix}-{int(now_utc.timestamp())}-{user.id}"
    try:
        stmt = select(NotificationLog).where(
            NotificationLog.user_id == user.id,
            NotificationLog.client_id == client_id,
        )
        res = await db.execute(stmt)
        existing_log = res.scalar_one_or_none()
        if existing_log:
            existing_log.title = title
            existing_log.body = body
            existing_log.occurred_at = now_utc
            existing_log.read_at = None
        else:
            log_entry = NotificationLog(
                user_id=user.id,
                client_id=client_id,
                type="system",
                level="info",
                title=title,
                body=body,
                occurred_at=now_utc,
                read_at=None,
            )
            db.add(log_entry)
        await db.commit()
    except Exception as exc:
        logger.warning("Failed to save briefing notification log: %s", exc)
        await db.rollback()

    return {
        "success": True,
        "title": title,
        "body": body,
        "web_push_sent": web_push_sent,
        "external_sent": external_sent,
    }


async def dispatch_scheduled_briefings(db: AsyncSession, current_time_hhmm: str) -> int:
    """Find all users scheduled for current_time_hhmm and dispatch."""
    stmt = select(User).where(User.is_active.is_(True), User.external_notifications.is_not(None))
    result = await db.execute(stmt)
    users = result.scalars().all()

    sent_count = 0
    for user in users:
        cfg = get_user_briefing_config(user)
        if cfg.get("enabled") and cfg.get("time") == current_time_hhmm:
            try:
                res = await dispatch_user_briefing(db, user)
                if res.get("success"):
                    sent_count += 1
            except Exception as exc:
                logger.warning("Failed to dispatch briefing to user %s: %s", user.id, exc)

    return sent_count
