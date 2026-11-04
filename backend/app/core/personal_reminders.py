"""Per-account planner reminders (ธุระ / ลาหยุด / อื่น ๆ).

Same shape as the notes and watchlist payloads: one JSON-as-text column, the
client saves its whole list, and a malformed row reads as an empty list instead
of breaking the widget. The difference is that a reminder is anchored to a
calendar day, because that is what the dashboard counts down to.
"""

import json
import logging
from datetime import date
from typing import Any, Iterable

logger = logging.getLogger(__name__)

MAX_REMINDERS = 200
MAX_TITLE = 120
MAX_NOTE = 300
VALID_KINDS = ("errand", "leave", "other")


def parse_personal_reminders(raw: str | None) -> list[dict[str, Any]]:
    """Return clean reminder dicts, skipping anything unusable."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("personal_reminders column holds invalid JSON; treating as empty")
        return []
    if not isinstance(parsed, list):
        return []

    reminders: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        reminder_id = item.get("id")
        raw_date = item.get("date")
        title = item.get("title")
        if not isinstance(reminder_id, str) or not reminder_id or len(reminder_id) > 64:
            continue
        if not isinstance(title, str) or not title.strip():
            continue
        if not isinstance(raw_date, str):
            continue
        try:
            date.fromisoformat(raw_date)
        except ValueError:
            continue

        kind = item.get("kind")
        entry: dict[str, Any] = {
            "id": reminder_id,
            "date": raw_date,
            "title": title.strip()[:MAX_TITLE],
            "kind": kind if kind in VALID_KINDS else "errand",
            "done": bool(item.get("done")),
        }
        note = item.get("note")
        if isinstance(note, str) and note.strip():
            entry["note"] = note.strip()[:MAX_NOTE]
        reminders.append(entry)
        if len(reminders) >= MAX_REMINDERS:
            break
    reminders.sort(key=lambda entry: entry["date"])
    return reminders


def serialize_personal_reminders(reminders: Iterable[Any]) -> str:
    """Persist the validated request list; accepts pydantic models or dicts."""
    payload: list[dict[str, Any]] = []
    for reminder in reminders:
        data = reminder.model_dump() if hasattr(reminder, "model_dump") else dict(reminder)
        title = str(data.get("title", "")).strip()[:MAX_TITLE]
        if not title:
            continue
        entry: dict[str, Any] = {
            "id": str(data.get("id", ""))[:64],
            "date": str(data.get("date", ""))[:10],
            "title": title,
            "kind": data.get("kind") if data.get("kind") in VALID_KINDS else "errand",
            "done": bool(data.get("done")),
        }
        note = data.get("note")
        if isinstance(note, str) and note.strip():
            entry["note"] = note.strip()[:MAX_NOTE]
        payload.append(entry)
        if len(payload) >= MAX_REMINDERS:
            break
    payload.sort(key=lambda entry: entry["date"])
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
