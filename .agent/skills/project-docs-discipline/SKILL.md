---
name: project-docs-discipline
description: Keeps ART Workspace's three internal documents (architecture, status, changelog) and the roadmap from drifting apart. Use only when a change alters behaviour, routes, endpoints, test numbers or an open finding, or when editing those documents directly — never for generic documentation writing.
when-to-use: After a commit that changes behaviour, adds/removes a route or endpoint, changes test counts or coverage, or closes/reopens a finding in docs/internal/status.md; also when editing docs/internal/**, docs/product/roadmap-features.md or README.md.
paths: ["docs/internal/**", "docs/product/roadmap-features.md", "README.md", "QUICK_START.md"]
user-invocable: false
---

# Project Docs Discipline

**Applies to this repository only.** Do not load it for writing API docs, READMEs of other projects,
or explaining code to a user.

## The split (do not merge these back)

| File | Owns | Must not contain |
|---|---|---|
| `docs/internal/architecture.md` | How the system is built and wired today | test counts, dates, history |
| `docs/internal/status.md` | Verified numbers, open findings with status, accepted constraints, deployed-only checks | dated sections, narrative |
| `docs/internal/changelog.md` | Dated record: what was found, changed, verified | "current" claims (numbers age by design) |
| `docs/product/roadmap-features.md` | What exists, what is planned, accepted constraints | architecture restatement, test numbers beyond the one constraint row |
| `docs/internal/project-analysis.md` | 20-line index for old links | anything else |

## Iron rules

1. **A dated narrative goes in `changelog.md` only.** Adding a new "## <Month> <day>, <year> — …"
   section to `status.md` or `architecture.md` is the exact drift this skill exists to prevent.
2. **Numbers are quoted from a command you just ran in this session.** If you did not run it, the row
   says "not re-run" — never copy a number forward from another document.
3. **Interpreter and date travel with coverage.** This suite measures differently on 3.11 (CI) and
   3.14 (local); a bare "82.83%" without the interpreter is an unusable claim.
4. **Closing a finding is a three-file edit:** set its Status in `status.md` §2, move it out of the
   list when it genuinely ships, and append a `changelog.md` entry with the commit sha plus the
   evidence (what was run, what it printed).
5. **When reality changes, first delete the false claim.** Two real drifts already happened here: a
   "Last updated" date eleven days behind the content, and a roadmap that denied self-service password
   reset months after `/forgot-password` shipped. Deleting a stale sentence beats appending a
   correction beside it.
6. **Relative links must resolve.** Run the link check below before finishing; `project-analysis.md`
   must stay an index so `README.md`, `QUICK_START.md` and the roadmap keep working.
7. **Do not restate `DESIGN.md`, `PRODUCT.md` or `design-system/MASTER.md`.** Link instead — duplicated
   design rules are how two sources of truth appear.

## Refresh commands (`status.md` §1)

```bash
cd backend && ./venv/Scripts/python.exe -m pytest -q          # count + coverage
cd backend && ./venv/Scripts/python.exe -m flake8 app
cd backend && ./venv/Scripts/python.exe -m mypy app
cd backend && DATABASE_URL="sqlite+aiosqlite:///./_check.db" \
  ./venv/Scripts/python.exe -m alembic upgrade head && \
  ./venv/Scripts/python.exe -m alembic check && rm -f _check.db
cd frontend && npx vitest run
cd frontend && npx tsc --noEmit && npx eslint .
```

Frontend `next build`, Playwright smoke/axe, `pip-audit` and every deployed check are **not** in the
local refresh loop — say so rather than implying they passed.

## Link and fence check

````bash
./backend/venv/Scripts/python.exe - <<'PY'
import re
from pathlib import Path
files = ["README.md","QUICK_START.md","docs/internal/architecture.md","docs/internal/status.md",
         "docs/internal/changelog.md","docs/internal/project-analysis.md",
         "docs/product/roadmap-features.md"]
bad = []
for f in files:
    t = Path(f).read_text(encoding="utf-8")
    for m in re.finditer(r"\]\(([^)#]+?)(?:#[^)]*)?\)", t):
        link = m.group(1).strip()
        if link.startswith(("http", "mailto:", "#")):
            continue
        if not (Path(f).parent / link).resolve().exists():
            bad.append((f, link))
    if len(re.findall(r'^```', t, re.M)) % 2:
        bad.append((f, "unbalanced code fence"))
print("broken links:", bad or "none")
PY
````

## Style

Markdown in English, CRLF line endings (the repo has no `.gitattributes`), one blank line between
sections, tables instead of long prose lists, `code` for file paths and commands.

## Done when

- The three documents still have exactly one owner each, and the change you made is in the right one.
- Every number in `status.md` §1 came from this session, with the interpreter noted.
- `changelog.md` gained one entry (if behaviour changed) and no other file gained a dated section.
- The link/fence check prints `none`.
