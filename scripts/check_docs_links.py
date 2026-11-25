#!/usr/bin/env python3
"""Fail when a relative link or a code fence in the owning documents is broken.

The documentation split (architecture / status / changelog / roadmap) only works
while the links between them resolve. A stale link is how the last docs drift
started, so CI checks this on every push instead of relying on a reviewer.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DOCUMENTS = [
    "README.md",
    "QUICK_START.md",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    "DESIGN.md",
    "design-system/workspace/MASTER.md",
    "docs/internal/architecture.md",
    "docs/internal/status.md",
    "docs/internal/changelog.md",
    "docs/internal/project-analysis.md",
    "docs/product/roadmap-features.md",
]

LINK = re.compile(r"\]\(([^)#]+?)(?:#[^)]*)?\)")
FENCE = re.compile(r"^```", re.MULTILINE)


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    problems: list[str] = []

    for name in DOCUMENTS:
        path = root / name
        if not path.exists():
            problems.append(f"{name}: file is missing")
            continue
        text = path.read_text(encoding="utf-8")
        for match in LINK.finditer(text):
            link = match.group(1).strip()
            if link.startswith(("http", "mailto:", "#")):
                continue
            if not (path.parent / link).resolve().exists():
                problems.append(f"{name}: broken link -> {link}")
        if len(FENCE.findall(text)) % 2:
            problems.append(f"{name}: unbalanced code fence")

    if problems:
        print("\n".join(problems))
        return 1
    print(f"docs: {len(DOCUMENTS)} files, links and fences OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
