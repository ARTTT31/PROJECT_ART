"""The .env templates and ``Settings`` must agree on every documented key.

``Settings`` is built with ``extra="ignore"``, so a key that a template
documents but ``Settings`` does not declare is dropped without a word: the
deployment sets it, sees no effect, and has nothing to search for. That is
exactly how ``SMTP_STARTTLS`` and ``EMAIL_VERIFY_TOKEN_MINUTES`` were briefly
invisible — the code read differently-spelled fields while the template told
operators to set these. The check is automated so it cannot happen silently again.
"""

import re
from pathlib import Path
from typing import Dict, Set

import pytest

from app.core.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = (REPO_ROOT / ".env.example", REPO_ROOT / "backend" / ".env.example")

# Documented on purpose, but deliberately not ``Settings`` fields.
#
# Frontend and deploy tooling read these (Next.js rewrites, the Sentry build
# plugin), or the key belongs to an optional feature the backend does not read
# yet. Nothing here is a backend runtime setting.
NOT_A_SETTINGS_FIELD = {
    "API_INTERNAL_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SENTRY_DSN",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "NEXT_PUBLIC_USE_SAME_ORIGIN_API",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    # Web push: documented for the PWA tooling; no backend code reads them yet.
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    # Read per call through os.getenv() rather than at import, so a change does
    # not need a redeploy (/auth responses and the cookie posture depend on them).
    "COOKIE_SAMESITE",
    "COOKIE_SECURE",
    "GOOGLE_ALLOWED_DOMAINS",
    "GOOGLE_VALID_CLIENT_IDS",
}

_ASSIGNMENT = re.compile(r"^([A-Z][A-Z0-9_]*)=")


def _documented_keys(path: Path) -> Dict[str, int]:
    """Every ``KEY=`` a template declares, mapped to the line it is on."""
    keys: Dict[str, int] = {}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        match = _ASSIGNMENT.match(line.strip())
        if match:
            keys.setdefault(match.group(1), number)
    return keys


@pytest.mark.parametrize("template", TEMPLATES, ids=["root", "backend"])
def test_every_documented_key_is_accepted_by_settings(template: Path) -> None:
    accepted: Set[str] = set(Settings.model_fields)

    ignored = [
        f"{key} (line {line})"
        for key, line in _documented_keys(template).items()
        if key not in accepted and key not in NOT_A_SETTINGS_FIELD
    ]

    assert not ignored, (
        f"{template.name} documents keys that Settings would silently ignore: "
        f"{', '.join(sorted(ignored))}. Add the field to Settings under the same "
        "name, or move the key into NOT_A_SETTINGS_FIELD with the reason."
    )


def test_the_exemption_list_has_no_stale_entries() -> None:
    """A key no template documents any more must not linger in the exemptions."""
    documented: Set[str] = set()
    for template in TEMPLATES:
        documented |= set(_documented_keys(template))

    stale = sorted(NOT_A_SETTINGS_FIELD - documented)
    assert not stale, f"remove from NOT_A_SETTINGS_FIELD: {', '.join(stale)}"
