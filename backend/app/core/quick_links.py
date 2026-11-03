"""Server-side validation for the ``users.quick_links`` JSON blob.

The endpoint used to store whatever string arrived (capped at 100KB only), so a
crafted request could persist ``javascript:`` URLs, thousands of entries, or
duplicate ids — and every ``/profile/me`` response then carried them. Finance and
the watchlist already sanitise on the way in (``app/core/personal_lists.py``);
quick links were the exception. This module mirrors the shape the frontend
writes in ``frontend/src/utils/quickLinks.ts``.
"""

import json
import logging
from typing import Any, Iterable

logger = logging.getLogger(__name__)

MAX_QUICK_LINKS = 24
MAX_LABEL_LENGTH = 40
MAX_URL_LENGTH = 2048
MAX_ID_LENGTH = 64
ENVIRONMENT_KEYS = ("staging", "development")

# Same default the frontend and ``app/api/dependencies.py`` apply for a NULL
# column: an account that predates page permissions gets dashboard + profile.
DEFAULT_PAGES = ("dashboard", "profile")

# Shortcut seeded into a newly created account, per page it may open.
_PAGE_SHORTCUTS: dict[str, tuple[str, str, str, str]] = {
    "dashboard": ("หน้าหลัก", "/dashboard", "home", "#0066cc"),
    "camera": ("กล้องวงจรปิด", "/camera", "camera", "#5856d6"),
    "admin": ("จัดการระบบ", "/admin", "shield", "#ff9500"),
}


def _clean_url(raw: Any) -> str | None:
    """An absolute http(s) URL or a single-slash in-app path, else None."""
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value or len(value) > MAX_URL_LENGTH:
        return None
    lowered = value.lower()
    if lowered.startswith("//"):
        # Protocol-relative: the scheme is inherited from the page and is not
        # ours to trust, so it is rejected rather than guessed.
        return None
    if value.startswith("/"):
        return value
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return value
    return None


def _clean_environment_urls(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, str] = {}
    for key in ENVIRONMENT_KEYS:
        url = _clean_url(raw.get(key))
        if url:
            cleaned[key] = url
    return cleaned


def _clean_entry(entry: Any) -> dict[str, Any] | None:
    if not isinstance(entry, dict):
        return None

    entry_id = entry.get("id")
    label = entry.get("label")
    icon = entry.get("icon")
    url = _clean_url(entry.get("url"))

    if not isinstance(entry_id, str) or not entry_id.strip():
        return None
    if not isinstance(label, str) or not label.strip():
        return None
    if not isinstance(icon, str) or not icon.strip():
        return None
    if not url:
        return None

    cleaned: dict[str, Any] = {
        "id": entry_id.strip()[:MAX_ID_LENGTH],
        "label": label.strip()[:MAX_LABEL_LENGTH],
        "url": url,
        "icon": icon.strip()[:32],
    }

    color = entry.get("color")
    if isinstance(color, str) and color.strip():
        cleaned["color"] = color.strip()[:32]

    envs = _clean_environment_urls(entry.get("envs"))
    if envs:
        cleaned["envs"] = envs

    return cleaned


def _clean_links(entries: Iterable[Any]) -> list[dict[str, Any]]:
    """Validate, de-duplicate and cap a list while preserving order."""
    seen_ids: set[str] = set()
    seen_urls: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in map(_clean_entry, entries):
        if not item:
            continue
        if item["id"] in seen_ids or item["url"] in seen_urls:
            continue
        seen_ids.add(item["id"])
        seen_urls.add(item["url"])
        result.append(item)
        if len(result) >= MAX_QUICK_LINKS:
            break
    return result


def parse_quick_links(raw: str | None) -> list[dict[str, Any]]:
    """Return the stored links as clean dicts; a bad blob reads as empty."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("quick_links column holds invalid JSON; treating as empty")
        return []
    if not isinstance(parsed, list):
        return []
    return _clean_links(parsed)


def serialize_quick_links(entries: Iterable[Any] | str) -> str:
    """Store the validated list as compact JSON text."""
    if isinstance(entries, str):
        return serialize_quick_links(parse_quick_links(entries))
    cleaned = _clean_links(list(entries))
    return json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))


def _pages_for(role: str, accessible_pages: str | None) -> list[str]:
    if role == "admin":
        return ["dashboard", "camera", "admin"]
    if not accessible_pages:
        return list(DEFAULT_PAGES)
    try:
        parsed = json.loads(accessible_pages)
    except (TypeError, ValueError):
        return list(DEFAULT_PAGES)
    if not isinstance(parsed, list):
        return list(DEFAULT_PAGES)
    return [str(page) for page in parsed]


def default_quick_links(role: str, accessible_pages: str | None) -> str:
    """The starting shortcut list for a freshly created account.

    Only pages the account may actually open are seeded, so a new member never
    starts with a link the sidebar would hide again — the opposite of the empty
    list that a browser gives a new profile.
    """
    pages = _pages_for(role, accessible_pages)
    entries: list[dict[str, Any]] = []
    for page in ("dashboard", "camera", "admin"):
        if page == "admin" and role != "admin":
            continue
        if page not in pages:
            continue
        label, url, icon, color = _PAGE_SHORTCUTS[page]
        entries.append(
            {"id": f"seed-{page}", "label": label, "url": url, "icon": icon, "color": color}
        )
    return json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
