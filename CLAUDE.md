# CLAUDE.md — AI Instructions for Claude Code

See [AGENTS.md](AGENTS.md) and [GEMINI.md](GEMINI.md) for full project rules and guidelines.

## Skill Routing
Before taking action, identify your task and consult the matching skill. The matrix is maintained once, in [AGENTS.md](AGENTS.md#-automatic-skill-routing-matrix) — read it there rather than keeping a second copy here; the domains, target files and mandatory skills are all listed in that table.

## Strict Rules
- **CSS Custom Properties**: Always use variables from `frontend/src/app/globals.css` (e.g., `bg-[var(--surface)]`, `bg-[var(--accent)]`); do not hardcode hex values.
- **Apple HIG Standard**: Flat surfaces, 1px hairlines, squircle radii (`apple-lg` 18px / `apple-md` 11px), springy active states (`active:scale-[0.95]`).
- **Testing**: Run Vitest (`npm run test`) and type-checks for frontend; `pytest` and `alembic check` for backend.
