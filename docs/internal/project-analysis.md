# Project Analysis — Index

**This file no longer holds the analysis.** It was split on November 11, 2026 because one
append-only document that carried architecture, current numbers *and* history had started to
contradict itself. The path is kept so existing links from `README.md`, `QUICK_START.md` and the
roadmap still land somewhere useful.

| Read this | For |
|---|---|
| [`architecture.md`](architecture.md) | How the system is built and wired today — stack, request path, frontend structure, backend modules, data model, auth, external data and caching, realtime, AI, background work, operations |
| [`status.md`](status.md) | What is verified right now (numbers plus the commands that produced them), every open finding from the 2026-11-10 audit with its status, accepted constraints, and the deployed-only checks nobody can close locally |
| [`changelog.md`](changelog.md) | The dated record of every pass since 2026-10-01 — what was found, what changed, and how it was verified |

**Last full verification:** 2026-11-11 on `main` at `623fd3a` — backend 590 passed at 82.83% coverage,
frontend 387 Vitest tests, lint/type-check clean, Alembic chain with no drift. Details in
[`status.md`](status.md).

**Rule for future edits.** A dated narrative belongs in `changelog.md`; numbers, gaps and their status
belong in `status.md`; the shape of the system belongs in `architecture.md`. Do not re-grow this file
into a log.
