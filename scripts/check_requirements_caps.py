#!/usr/bin/env python3
"""Fail when a requirement states a lower bound without an upper one.

A bare floor such as `argon2-cffi>=25.1.0` lets pip resolve the *next major* the
day it is released, with no commit in this repository. sentry-sdk 3.0 did
exactly that and turned `mypy` red on a push that never touched the SDK.
`pip-audit` cannot see the class of failure — it looks for CVEs, not API
changes — so the caps in `backend/requirements.in` only hold while something
checks them. The compiled `backend/requirements.lock` inherits the resolved
versions, so the input file is the only place the rule has to hold.

An exact pin (`==`) is bounded already, and `~=`, `<`, `<=` and `!=` are
accepted. Only "`>=` with no upper bound" fails. Pass a path to check another
file (handy when raising a cap); CI runs it with no argument.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DEFAULT_REQUIREMENTS = Path(__file__).resolve().parent.parent / "backend" / "requirements.in"

# ` # comment` — a `#` preceded by whitespace — is not part of the requirement.
INLINE_COMMENT = re.compile(r"\s+#.*$")


def requirement_of(line: str) -> str | None:
    """Return the requirement on a line, or None for blank/comment/option lines."""
    text = INLINE_COMMENT.sub("", line).strip()
    if not text or text.startswith(("#", "-")):
        return None
    if "://" in text or text.startswith(("git+", "file:")):
        return None
    return text


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT_REQUIREMENTS
    problems: list[str] = []
    checked = 0

    with path.open(encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            requirement = requirement_of(line)
            if requirement is None:
                continue
            checked += 1
            if ">=" in requirement and "<" not in requirement:
                problems.append(
                    f"{path}:{number}: {requirement} has a floor but no ceiling — "
                    "write it as >=x.y,<next-major"
                )

    if problems:
        print("\n".join(problems))
        return 1
    print(f"requirements: {checked} specs, every floor has a ceiling")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
