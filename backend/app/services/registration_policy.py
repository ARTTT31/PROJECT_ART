"""Single source of truth for the self-registration policy.

Two admin-facing surfaces describe this policy:

- ``GET /api/v1/auth/registration-mode`` — the public answer the login and
  register pages build their UI from.
- ``GET /api/v1/system/branding`` — the branding payload (and the admin form
  that edits it).

Reading ``SystemSetting`` differently in each place used to make them disagree:
branding defaulted to ``approval`` while the registration endpoint fell back to
``settings.REGISTRATION_MODE`` (``closed``), so the sign-up form appeared and
then every submission was refused. Both endpoints now resolve the value here.

Resolution order is deliberate: the admin-edited database setting wins, and the
environment variable is the fallback for deployments that have not saved one
yet (including a database where the seed row is missing).
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)

REGISTRATION_MODES = ("closed", "approval", "open")


async def get_effective_registration_mode(db: AsyncSession) -> str:
    """Return the mode every registration-related surface must agree on."""
    try:
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == "registration_mode")
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value in REGISTRATION_MODES:
            return setting.value
    except Exception as exc:  # pragma: no cover - defensive: DB error fallback
        logger.debug("Could not read registration_mode from SystemSetting: %s", exc)
    return settings.REGISTRATION_MODE
