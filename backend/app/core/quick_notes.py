"""Read/write the JSON blob behind the dashboard notes widget.

The list lives in ``users.quick_notes`` as text, like the other per-user JSON
preferences. Reads are deliberately tolerant: a row written by an older build
(or edited by hand) may contain anything, and one malformed entry must not take
the whole widget down — the valid items are kept and the rest dropped.
"""

import json
import logging
from typing import Any, Iterable

logger = logging.getLogger(__name__)

MAX_QUICK_NOTES = 50
MAX_NOTE_TEXT = 200


def parse_quick_notes(raw: str | None) -> list[dict[str, Any]]:
    """Return the stored notes as clean ``{id, text, done}`` dicts.

    ``None`` (never used), invalid JSON and non-list payloads all read as an
    empty list. Entries missing a usable id or text are skipped.
    """
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("quick_notes column holds invalid JSON; treating as empty")
        return []
    if not isinstance(parsed, list):
        return []

    notes: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        note_id = item.get("id")
        text = item.get("text")
        if not isinstance(note_id, str) or not note_id or len(note_id) > 64:
            continue
        if not isinstance(text, str) or not text.strip():
            continue
        notes.append(
            {
                "id": note_id,
                "text": text.strip()[:MAX_NOTE_TEXT],
                "done": bool(item.get("done")),
            }
        )
        if len(notes) >= MAX_QUICK_NOTES:
            break
    return notes


def serialize_quick_notes(notes: Iterable[Any]) -> str:
    """Store the validated request list as compact JSON text.

    Accepts pydantic ``QuickNote`` instances as well as plain dicts so callers
    do not have to convert first.
    """
    payload: list[dict[str, Any]] = []
    for note in notes:
        data = note.model_dump() if hasattr(note, "model_dump") else dict(note)
        text = str(data.get("text", "")).strip()[:MAX_NOTE_TEXT]
        if not text:
            continue
        payload.append(
            {
                "id": str(data.get("id", ""))[:64],
                "text": text,
                "done": bool(data.get("done")),
            }
        )
        if len(payload) >= MAX_QUICK_NOTES:
            break
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
