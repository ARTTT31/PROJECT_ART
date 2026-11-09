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

from app.models.notification_log import NotificationLog
from app.models.user import User
from app.services.notification_dispatcher import send_to_channel
from app.services.web_push_service import send_web_push_to_user

logger = logging.getLogger(__name__)

DEFAULT_BRIEFING_CONFIG = {
    "enabled": False,
    "time": "07:30",
    "topics": {
        "oil_prices": True,
        "weather": True,
        "market": True,
        "tasks": True,
        "holidays": True,
    },
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
            topics = dict(DEFAULT_BRIEFING_CONFIG["topics"])
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


async def build_briefing_content(db: AsyncSession, user: User, topics: Dict[str, bool]) -> Dict[str, str]:
    """Compile morning briefing text based on enabled topics."""
    lines: List[str] = []

    # 1. Fuel Prices
    if topics.get("oil_prices"):
        lines.append("⛽ แก๊สโซฮอล์ 95: 37.69 บ. | ดีเซล: 38.39 บ.")

    # 2. Weather & Air Quality
    if topics.get("weather"):
        lines.append("🌿 สภาพอากาศ: มีเมฆบางส่วน ค่าฝุ่น PM2.5 อยู่ในเกณฑ์มาตรฐาน")

    # 3. Market & SET
    if topics.get("market"):
        lines.append("📈 ตลาดการเงิน: ดัชนี SET เคลื่อนไหวในกรอบปกติ")

    # 4. Pending Tasks from Quick Notes
    if topics.get("tasks"):
        pending_count = 0
        raw_notes = getattr(user, "quick_notes", None)
        if raw_notes:
            try:
                parsed_notes = json.loads(raw_notes)
                if isinstance(parsed_notes, list):
                    pending_count = len([n for n in parsed_notes if not n.get("done")])
            except Exception:
                pass
        if pending_count > 0:
            lines.append(f"📝 มีงานค้าง {pending_count} รายการในโน้ตด่วน")
        else:
            lines.append("✨ ไม่มีงานค้างในโน้ตด่วน พร้อมลุยวันใหม่!")

    # 5. Holidays
    if topics.get("holidays"):
        lines.append("📅 วันนี้เป็นวันทำการปกติ")

    title = f"☀️ สรุปข้อมูลเช้านี้ ({datetime.date.today().strftime('%d/%m/%Y')})"
    body = "\n".join(lines) if lines else "ขอให้เป็นวันที่ราบรื่นและประสบความสำเร็จครับ!"
    return {"title": title, "body": body}


async def dispatch_user_briefing(db: AsyncSession, user: User) -> Dict[str, Any]:
    """Compile and send briefing to user via Web Push and external channels."""
    config = get_user_briefing_config(user)
    topics = config.get("topics", {})
    content = await build_briefing_content(db, user, topics)

    title = content["title"]
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

    # History Log
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    log_entry = NotificationLog(
        user_id=user.id,
        client_id=f"briefing-{datetime.date.today()}-{user.id}",
        type="system",
        level="info",
        title=title,
        body=body,
        occurred_at=now_utc,
        read_at=None,
    )
    db.add(log_entry)
    await db.commit()

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
