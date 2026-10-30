"""Read/write the JSON blobs behind the finance and watchlist widgets.

Both live in ``users.*`` text columns as JSON arrays, like ``quick_notes`` and
``quick_links``. Reads are deliberately tolerant: a row written by an older
build (or edited by hand) may contain anything, and one malformed entry must
not take the whole widget down — valid items are kept and the rest dropped.
"""

import json
import logging
import math
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


def _entry_data(entry: Any) -> dict[str, Any] | None:
    """Return a plain mapping for a stored dict or a pydantic request model.

    ``PUT /profile/finance`` and ``PUT /profile/watchlist`` hand the serialisers
    pydantic instances, while rows read back from the database are dicts. Both
    must go through the same validation; treating only dicts as valid silently
    saved an empty list for finance and raised ``TypeError`` for watchlist.
    """
    if isinstance(entry, dict):
        return entry
    model_dump = getattr(entry, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump()
        return dumped if isinstance(dumped, dict) else None
    return None


# ── Finance (income / expense) ───────────────────────────────────────────────


def _clean_finance_entry(entry: Any) -> dict[str, Any] | None:
    data = _entry_data(entry)
    if data is None:
        return None

    entry_id = data.get("id")
    if not isinstance(entry_id, str) or not entry_id.strip():
        return None

    entry_type = data.get("type")
    if entry_type not in ("income", "expense"):
        return None

    label = str(data.get("label") or "").strip()[:MAX_FINANCE_LABEL]

    raw_amount = data.get("amount")
    # Legacy rows stored the amount as a string; pydantic sends a number. A
    # bool is an int subclass and would silently become 1.0, so reject it.
    if isinstance(raw_amount, bool) or not isinstance(raw_amount, (int, float, str)):
        return None
    try:
        amount = float(raw_amount)
    except (TypeError, ValueError):
        return None
    # NaN passes both comparisons, and ``json.dumps`` would then persist the
    # non-standard ``NaN`` token — later reads and the browser's JSON parser
    # reject it. Infinity is caught by the upper bound, NaN is not.
    if not math.isfinite(amount) or amount <= 0 or amount > MAX_MONEY:
        return None

    raw_date = data.get("date")
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
    raw_label: Any = None
    if isinstance(entry, str):
        raw_symbol: Any = entry
    else:
        data = _entry_data(entry)
        if data is None:
            return None
        raw_symbol = data.get("symbol")
        raw_label = data.get("label")

    if not isinstance(raw_symbol, str):
        return None
    symbol = raw_symbol.strip().upper()
    if not symbol or not _SYMBOL_RE.match(symbol):
        return None

    cleaned: dict[str, Any] = {"symbol": symbol}
    if isinstance(raw_label, str) and raw_label.strip():
        cleaned["label"] = raw_label.strip()[:40]
    return cleaned


def _clean_watchlist(entries: Iterable[Any]) -> list[dict[str, Any]]:
    """Validate, de-duplicate and cap a watchlist while preserving order."""
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in map(_clean_symbol, entries):
        if not item or item["symbol"] in seen:
            continue
        seen.add(item["symbol"])
        result.append(item)
        if len(result) >= MAX_WATCHLIST_SYMBOLS:
            break
    return result


def parse_watchlist(raw: str | None) -> list[dict[str, Any]]:
    """Return the followed symbols, de-duplicated and order-preserving."""
    return _clean_watchlist(_load_list(raw, "watchlist"))


def serialize_watchlist(entries: Iterable[Any]) -> str:
    """Store the validated request list as compact JSON text."""
    cleaned = _clean_watchlist(entries)
    return json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))
