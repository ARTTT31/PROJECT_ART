"""Workspace-wide page switches.

Per-user ``accessible_pages`` remains the authorization boundary: it decides
which pages one account may open, and the backend keeps enforcing it. This
setting sits above that and answers a different question — *is the page open for
the workspace at all right now?* An admin can close the camera page for everyone
without editing every account.

The two required pages (dashboard and profile) can never be switched off: hiding
them would leave an account with nowhere to land and no way to change its own
settings. The admin console and the activity log are admin-only: a switch there
would only confuse a member who can never open them, so those two are fixed on
and the card labels them as admin-only instead of offering a toggle.
"""

import json
import logging
from typing import Any, Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)

SETTING_KEY = "enabled_pages"

PAGE_CATALOGUE: tuple[dict[str, Any], ...] = (
    {"id": "dashboard", "label": "หน้าหลัก", "required": True, "admin_only": False},
    {"id": "camera", "label": "กล้องวงจรปิด", "required": False, "admin_only": False},
    {"id": "admin", "label": "จัดการระบบ", "required": False, "admin_only": True},
    {"id": "audit", "label": "บันทึกกิจกรรม", "required": False, "admin_only": True},
    {"id": "profile", "label": "โปรไฟล์", "required": True, "admin_only": False},
)

PAGE_IDS: tuple[str, ...] = tuple(page["id"] for page in PAGE_CATALOGUE)
REQUIRED_PAGE_IDS: tuple[str, ...] = tuple(
    page["id"] for page in PAGE_CATALOGUE if page["required"]
)
ADMIN_ONLY_PAGE_IDS: tuple[str, ...] = tuple(
    page["id"] for page in PAGE_CATALOGUE if page.get("admin_only")
)
# Never switchable: required pages keep every account somewhere to land, and
# admin-only pages are invisible to members anyway.
LOCKED_PAGE_IDS: tuple[str, ...] = REQUIRED_PAGE_IDS + ADMIN_ONLY_PAGE_IDS


def default_enabled_pages() -> list[str]:
    """Everything is open until an admin says otherwise."""
    return list(PAGE_IDS)


def normalise_enabled_pages(raw: str | None) -> list[str]:
    """Parse the stored list, keeping only known ids and always the required ones."""
    if raw is None:
        return default_enabled_pages()
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("enabled_pages setting holds invalid JSON; treating as default")
        return default_enabled_pages()
    if not isinstance(parsed, list):
        return default_enabled_pages()

    enabled = {str(page) for page in parsed if str(page) in PAGE_IDS}
    enabled.update(LOCKED_PAGE_IDS)
    # Keep the catalogue order so the admin card and the sidebar agree.
    return [page_id for page_id in PAGE_IDS if page_id in enabled]


def serialize_enabled_pages(pages: Iterable[str]) -> str:
    enabled = [page for page in pages if page in PAGE_IDS]
    for locked in LOCKED_PAGE_IDS:
        if locked not in enabled:
            enabled.append(locked)
    ordered = [page_id for page_id in PAGE_IDS if page_id in enabled]
    return json.dumps(ordered, separators=(",", ":"))


async def get_enabled_pages(db: AsyncSession) -> list[str]:
    """Resolve the workspace switches; a database error falls back to all-open."""
    try:
        setting = await db.get(SystemSetting, SETTING_KEY)
    except Exception:  # pragma: no cover - defensive: never lock everyone out
        logger.warning("could not read enabled_pages; defaulting to all pages", exc_info=True)
        return default_enabled_pages()
    return normalise_enabled_pages(setting.value if setting else None)
