"""Default workspace naming shared by the branding endpoints and migrations.

Every account may name its own workspace, so the product no longer ships a
brand name of its own: ``Workspace`` is only the value used until someone
chooses something else.

Databases seeded before that change still carry the old product name, both in
``system_settings.company_name`` and in accounts that copied it as a personal
override. Reading through these helpers keeps those rows from resurfacing the
old name before the ``20261119_normalise_branding`` migration has run, and the
migration reuses the same predicate so the two can never disagree.
"""

DEFAULT_COMPANY_NAME = "Workspace"
DEFAULT_COMPANY_TAGLINE = "จัดการวันทำงานของคุณให้ง่ายขึ้น"

# Names the product shipped under before it became nameable. Compared
# case-insensitively after trimming so a stray space or casing cannot pin the
# old name in place.
LEGACY_COMPANY_NAMES = frozenset({"art workspace"})


def is_legacy_company_name(value: str | None) -> bool:
    """True when ``value`` is a retired product name."""
    if not value:
        return False
    return value.strip().casefold() in LEGACY_COMPANY_NAMES


def normalise_company_name(value: str | None) -> str:
    """The workspace-wide name to show: a real choice, else the neutral default."""
    name = (value or "").strip()
    if not name or is_legacy_company_name(name):
        return DEFAULT_COMPANY_NAME
    return name


def normalise_personal_workspace_name(value: str | None) -> str:
    """An account's own name, with legacy values folded back to "no override".

    Empty already means "use the workspace value"; a legacy name has to mean the
    same, otherwise the account would keep showing the retired brand instead of
    following a workspace that has since been renamed.
    """
    name = (value or "").strip()
    if not name or is_legacy_company_name(name):
        return ""
    return name
