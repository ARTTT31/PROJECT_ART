"""Company holiday calendar: stored JSON plus a tolerant PDF reader.

The dashboard already ships a hard-coded, confirmed list of Thai public
holidays (``frontend/src/utils/holidays.ts``). A company calendar is different:
it is whatever HR published for that year, so it has to be imported rather than
guessed. Admins upload the PDF HR sent; this module turns it into a draft list
of dates that the admin reviews before anything is saved.

Parsing is deliberately forgiving — a PDF is a print layout, not a data file.
Extraction handles the shapes Thai holiday announcements actually use:

- ``1 มกราคม 2569`` / ``1 ม.ค. 69`` / ``วันที่ 1 มกราคม พ.ศ. 2570``
- ``01/01/2570`` (day-first, the Thai convention) and ``2570-01-01``
- a title before or after the date, a weekday prefix, list numbering

Nothing here writes to the database; the endpoints own persistence.
"""

import io
import json
import logging
import re
from datetime import date
from typing import Any, Iterable, Mapping

logger = logging.getLogger(__name__)

SETTING_KEY = "company_holidays"

MAX_HOLIDAYS_PER_YEAR = 80
MAX_TITLE_LENGTH = 120
MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_PDF_PAGES = 40

BUDDHIST_YEAR_OFFSET = 543

# Full names and the abbreviations HR documents use. Matching is longest-first
# so "ม.ค." is not swallowed by a shorter alternative.
THAI_MONTHS: dict[str, int] = {
    "มกราคม": 1,
    "ม.ค.": 1,
    "กุมภาพันธ์": 2,
    "ก.พ.": 2,
    "มีนาคม": 3,
    "มี.ค.": 3,
    "เมษายน": 4,
    "เม.ย.": 4,
    "พฤษภาคม": 5,
    "พ.ค.": 5,
    "มิถุนายน": 6,
    "มิ.ย.": 6,
    "กรกฎาคม": 7,
    "ก.ค.": 7,
    "สิงหาคม": 8,
    "ส.ค.": 8,
    "กันยายน": 9,
    "ก.ย.": 9,
    "ตุลาคม": 10,
    "ต.ค.": 10,
    "พฤศจิกายน": 11,
    "พ.ย.": 11,
    "ธันวาคม": 12,
    "ธ.ค.": 12,
}

_THAI_MONTH_ALTERNATION = "|".join(
    re.escape(name) for name in sorted(THAI_MONTHS, key=len, reverse=True)
)

_THAI_DATE_RE = re.compile(
    r"(?P<day>\d{1,2})\s*(?P<month>" + _THAI_MONTH_ALTERNATION + r")\s*\.?\s*(?P<year>\d{4})"
)
_ISO_DATE_RE = re.compile(r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})")
_SLASH_DATE_RE = re.compile(
    r"(?P<day>\d{1,2})\s*[/.]\s*(?P<month>\d{1,2})\s*[/.]\s*(?P<year>\d{4})"
)
_YEAR_HINT_RE = re.compile(r"(?:ปี|พ\.ศ\.|ค\.ศ\.)?\s*(?P<year>25\d{2}|20\d{2})")

_WEEKDAY_RE = re.compile(
    r"วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัสฯ|พฤหัส|ศุกร์|เสาร์|อาทิตย์)"
)
_LEADING_NUMBER_RE = re.compile(r"^\s*\d{1,2}\s*[.)]\s*")
_SEPARATOR_CHARS = "-–—:|•·*#\t"


def normalise_year(year: int) -> int:
    """Convert a Buddhist year to a Gregorian one; leave Gregorian years alone."""
    return year - BUDDHIST_YEAR_OFFSET if year > 2400 else year


def _find_date(line: str) -> tuple[int, int, int] | None:
    """Return ``(year, month, day)`` plus the match span for the first date."""
    for pattern in (_ISO_DATE_RE, _THAI_DATE_RE, _SLASH_DATE_RE):
        match = pattern.search(line)
        if not match:
            continue
        try:
            year = normalise_year(int(match.group("year")))
            if pattern is _THAI_DATE_RE:
                month = THAI_MONTHS[match.group("month")]
            else:
                month = int(match.group("month"))
            day = int(match.group("day"))
        except (KeyError, TypeError, ValueError):
            continue
        return year, month, day
    return None


def _date_span(line: str) -> tuple[int, int] | None:
    for pattern in (_ISO_DATE_RE, _THAI_DATE_RE, _SLASH_DATE_RE):
        match = pattern.search(line)
        if match:
            return match.span()
    return None


def _clean_title(text: str) -> str:
    cleaned = _SEPARATOR_CHARS.join(" ")
    for char in _SEPARATOR_CHARS:
        text = text.replace(char, cleaned.strip() or " ")
    text = _WEEKDAY_RE.sub(" ", text)
    # "วันจันทร์ที่ 13 ..." leaves the classifier behind once the weekday goes.
    text = re.sub(r"^\s*ที่\s*", "", text)
    text = _LEADING_NUMBER_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip(" .,-–—:|")
    return text[:MAX_TITLE_LENGTH]


def _neighbour_title(lines: list[str], index: int) -> str:
    """A date on its own line usually has the holiday name on the next one."""
    for offset in (1, -1):
        position = index + offset
        if 0 <= position < len(lines):
            candidate = lines[position]
            if _find_date(candidate):
                continue
            title = _clean_title(candidate)
            if title:
                return title
    return ""


def parse_holiday_candidates(
    text: str, fallback_year: int | None = None
) -> tuple[list[dict[str, Any]], list[str]]:
    """Turn raw PDF text into a de-duplicated, date-sorted draft list.

    ``fallback_year`` is used only to report a warning when the document never
    mentions a year; dated lines always carry their own year.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    warnings: list[str] = []
    found: dict[str, dict[str, Any]] = {}

    for index, line in enumerate(lines):
        date_parts = _find_date(line)
        if date_parts is None:
            continue
        year, month, day = date_parts
        try:
            value = date(year, month, day)
        except ValueError:
            warnings.append(f"ข้ามวันที่ไม่ถูกต้อง: {line[:60]}")
            continue

        span = _date_span(line)
        rest = line if span is None else f"{line[: span[0]]} {line[span[1] :]}"
        title = _clean_title(rest) or _neighbour_title(lines, index)
        if not title:
            title = "วันหยุด"

        existing = found.get(value.isoformat())
        if existing is None or len(title) > len(existing["title"]):
            found[value.isoformat()] = {
                "date": value.isoformat(),
                "title": title,
            }
        if len(found) >= MAX_HOLIDAYS_PER_YEAR * 2:
            warnings.append("พบรายการมากกว่าปกติ หยุดอ่านที่รายการแรก ๆ เท่านั้น")
            break

    if not found and fallback_year is None:
        warnings.append("ไม่พบวันที่ในไฟล์ อาจเป็น PDF ที่เลือกข้อความไม่ได้ (สแกนเป็นภาพ)")

    items = sorted(found.values(), key=lambda item: item["date"])
    return items, warnings


def extract_pdf_text(data: bytes) -> str:
    """Read the text layer of a PDF; raises ``ValueError`` when it cannot."""
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - dependency is pinned
        raise ValueError("เซิร์ฟเวอร์ยังไม่ได้ติดตั้งตัวอ่าน PDF") from exc

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        raise ValueError("ไม่สามารถเปิดไฟล์ PDF นี้ได้") from exc

    chunks: list[str] = []
    for page in reader.pages[:MAX_PDF_PAGES]:
        try:
            chunks.append(page.extract_text() or "")
        except Exception:  # pragma: no cover - one broken page must not fail all
            logger.warning("could not extract text from a PDF page", exc_info=True)
    return "\n".join(chunks)


def parse_company_calendar(raw: str | None) -> dict[int, list[dict[str, Any]]]:
    """Read the stored JSON, dropping anything malformed."""
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("company_holidays setting holds invalid JSON; treating as empty")
        return {}
    if not isinstance(parsed, dict):
        return {}

    calendar: dict[int, list[dict[str, Any]]] = {}
    for key, items in parsed.items():
        try:
            year = int(key)
        except (TypeError, ValueError):
            continue
        if not isinstance(items, list):
            continue
        cleaned: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            raw_date = item.get("date")
            title = item.get("title")
            if not isinstance(raw_date, str) or not isinstance(title, str):
                continue
            try:
                date.fromisoformat(raw_date)
            except ValueError:
                continue
            if not title.strip():
                continue
            entry: dict[str, Any] = {
                "date": raw_date,
                "title": title.strip()[:MAX_TITLE_LENGTH],
            }
            description = item.get("description")
            if isinstance(description, str) and description.strip():
                entry["description"] = description.strip()[:300]
            cleaned.append(entry)
        cleaned.sort(key=lambda entry: entry["date"])
        calendar[year] = cleaned
    return calendar


def serialize_company_calendar(calendar: Mapping[int, Iterable[dict[str, Any]]]) -> str:
    """Store only the years that still have entries, as compact JSON."""
    payload: dict[str, list[dict[str, Any]]] = {}
    for year, items in calendar.items():
        rows = [
            {key: value for key, value in item.items() if value not in (None, "")}
            for item in items
        ]
        if rows:
            payload[str(year)] = rows
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
