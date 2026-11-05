# CLAUDE.md — AI Instructions for Claude Code

See [AGENTS.md](AGENTS.md) and [GEMINI.md](GEMINI.md) for full project rules and guidelines.

## Quick Summary & Skill Routing Matrix
Before taking action, identify your task and consult the matching skill:
- **UI/UX & Design Intelligence**: `.agent/skills/ui-ux-pro-max/` (`py scripts/search.py ...`) + [DESIGN.md](DESIGN.md) + [design-system/art-workspace/MASTER.md](design-system/art-workspace/MASTER.md)
- **UI Components & Composition**: `.agent/skills/shadcn/` (shadcn/ui + Radix primitives)
- **PWA & Offline Optimization**: `.agent/skills/pwa-development/` (Workbox, caching, offline-first)
- **Backend API & Endpoints**: `.agent/skills/fastapi/` (Routing, `Annotated` dependencies, streaming)
- **Database & ORM Models**: `.agent/skills/sqlmodel/` (SQLModel models, session queries, migrations)

## Strict Rules
- **CSS Custom Properties**: Always use variables from `frontend/src/app/globals.css` (e.g., `bg-[var(--surface)]`, `bg-[var(--accent)]`); do not hardcode hex values.
- **Apple HIG Standard**: Flat surfaces, 1px hairlines, squircle radii (`apple-lg` 18px / `apple-md` 11px), springy active states (`active:scale-[0.95]`).
- **Testing**: Run Vitest (`npm run test`) and type-checks for frontend; `pytest` and `alembic check` for backend.
