"""Read/write the JSON blobs behind the finance and watchlist widgets.

Both live in ``users.*`` text columns as JSON arrays, like ``quick_notes`` and
``quick_links``. Reads are deliberately tolerant: a row written by an older
build (or edited by hand) may contain anything, and one malformed entry must
not take the whole widget down — valid items are kept and the rest dropped.
"""

import json
import logging
import re
from datetime import date
from typing import Any, Iterable

logger = logging.getLogger(__name__)

MAX_FINANCE_ENTRIES = 200
MAX_FINANCE_LABEL = 60
MAX_MONEY = 1_000_000_000
MAX_WATCHLIST_SYMBOLS = 30
MAX_SYMBOL_LENGTH = 24

_SYMBOL_RE = re.compile(r"^[A-Z0-9.^=\-]{1,24}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _load_list(raw: str | None, label: str) -> list[Any]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("%s column holds invalid JSON; treating as empty", label)
        return []
    return parsed if isinstance(parsed, list) else []


# ── Finance (income / expense) ───────────────────────────────────────────────


def _clean_finance_entry(entry: Any) -> dict[str, Any] | None:
    if not isinstance(entry, dict):
        return None

    entry_id = entry.get("id")
    if not isinstance(entry_id, str) or not entry_id.strip():
        return None

    entry_type = entry.get("type")
    if entry_type not in ("income", "expense"):
        return None

    label = str(entry.get("label") or "").strip()[:MAX_FINANCE_LABEL]

    try:
        amount = float(entry.get("amount"))
    except (TypeError, ValueError):
        return None
    if amount <= 0 or amount > MAX_MONEY:
        return None

    raw_date = entry.get("date")
    if not isinstance(raw_date, str) or not _DATE_RE.match(raw_date):
        return None
    try:
        date.fromisoformat(raw_date)
    except ValueError:
        return None

    return {
        "id": entry_id.strip()[:64],
        "type": entry_type,
        "label": label,
        "amount": round(amount, 2),
        "date": raw_date,
    }


def parse_finance_entries(raw: str | None) -> list[dict[str, Any]]:
    """Return the stored entries as clean ``{id,type,label,amount,date}`` dicts."""
    cleaned = [item for item in map(_clean_finance_entry, _load_list(raw, "finance_entries")) if item]
    return cleaned[:MAX_FINANCE_ENTRIES]


def serialize_finance_entries(entries: Iterable[Any]) -> str:
    """Store the validated request list as compact JSON text."""
    cleaned = [item for item in map(_clean_finance_entry, entries) if item]
    return json.dumps(cleaned[:MAX_FINANCE_ENTRIES], ensure_ascii=False, separators=(",", ":"))


# ── Watchlist ────────────────────────────────────────────────────────────────


def _clean_symbol(entry: Any) -> dict[str, Any] | None:
    if isinstance(entry, str):
        symbol, label = entry, None
    elif isinstance(entry, dict):
        symbol = entry.get("symbol")
        label = entry.get("label")
    else:
        return None

    if not isinstance(symbol, str):
        return None
    symbol = symbol.strip().upper()
    if not symbol or not _SYMBOL_RE.match(symbol):
        return None

    cleaned: dict[str, Any] = {"symbol": symbol}
    if isinstance(label, str) and label.strip():
        cleaned["label"] = label.strip()[:40]
    return cleaned


def parse_watchlist(raw: str | None) -> list[dict[str, Any]]:
    """Return the followed symbols, de-duplicated and order-preserving."""
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in map(_clean_symbol, _load_list(raw, "watchlist")):
        if not item or item["symbol"] in seen:
            continue
        seen.add(item["symbol"])
        result.append(item)
        if len(result) >= MAX_WATCHLIST_SYMBOLS:
            break
    return result


def serialize_watchlist(entries: Iterable[Any]) -> str:
    return json.dumps(parse_watchlist(json.dumps(list(entries), ensure_ascii=False)), ensure_ascii=False, separators=(",", ":"))
