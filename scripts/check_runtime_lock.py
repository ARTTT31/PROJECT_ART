#!/usr/bin/env python3
"""Fail when a test/lint tool leaks into the deployed dependency lock.

`backend/requirements.lock` is what Render's build installs. The split only holds
while that file stays runtime-only: a stray line in `backend/requirements.in`, or
a lock regenerated from the wrong input, silently puts pytest, flake8, mypy or
the SQLite driver back into every production image. Nothing in `backend/app`
imports them, so the install still succeeds and no test notices — hence a gate.

`backend/requirements-dev.lock` is the superset and is expected to contain these
names, so only the runtime lock is checked. Pass a path to check another file.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DEFAULT_LOCK = Path(__file__).resolve().parent.parent / "backend" / "requirements.lock"

# Distribution names as they appear at the start of a pip-compile pin line.
FORBIDDEN = ("pytest", "flake8", "mypy", "aiosqlite")

# A pin line: `name==1.2.3`, `name[extra]==1.2.3`, both possibly followed by ` \`.
PIN = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?==([^\s;\\]+)")


def normalise(name: str) -> str:
    """PEP 503 name normalisation, so `aiosqlite` and `aiosqlite` compare equal."""
    return re.sub(r"[-_.]+", "-", name).lower()


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT_LOCK
    forbidden = {normalise(name) for name in FORBIDDEN}
    problems: list[str] = []
    pins = 0

    with path.open(encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            match = PIN.match(line)
            if match is None:
                continue
            pins += 1
            if normalise(match.group(1)) in forbidden:
                problems.append(
                    f"{path}:{number}: {match.group(1)}=={match.group(2)} is test/lint "
                    "tooling: it belongs in backend/requirements-dev.in, not in the "
                    "lock Render installs"
                )

    if problems:
        print("\n".join(problems))
        return 1
    print(f"runtime lock: {pins} pins, no test/lint tooling")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
