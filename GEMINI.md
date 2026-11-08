@./.agent/skills/using-superpowers/SKILL.md

# Guidelines & Pre-Flight Instructions for AI Assistants

All AI agents working on this codebase MUST follow these instructions before executing any task:

## 🧭 Automatic Skill Routing Matrix
Before modifying or creating any code, AI agents MUST invoke and follow the relevant installed skill:

| Domain / Task | Target Files | Mandatory Skills to Check & Follow |
| :--- | :--- | :--- |
| **UI/UX & Design Intelligence** | `frontend/src/**/*`, styles, pages | `.agent/skills/ui-ux-pro-max/` (via `py scripts/search.py`) + [DESIGN.md](DESIGN.md) + [design-system/art-workspace/MASTER.md](design-system/art-workspace/MASTER.md) |
| **UI Components & Radix/Tailwind** | `frontend/src/components/**/*` | `.agent/skills/shadcn/` (shadcn/ui composition, CLI, Radix primitives) |
| **PWA, Service Workers & Caching** | `frontend/public/manifest*`, `sw.*`, offline logic | `.agent/skills/pwa-development/` (Workbox, caching strategies, offline-first) |
| **Backend API & Endpoints** | `backend/app/api/**/*`, `backend/app/main.py` | `.agent/skills/fastapi/` (Routing, dependencies with `Annotated`, streaming/SSE) |
| **Database & ORM Models** | `backend/app/models/**/*`, `backend/app/db/**/*` | `.agent/skills/sqlmodel/` (SQLModel field definitions, sessions, query patterns) |

---

## 1. UI/UX & Frontend Development Pre-Flight Checklist
Before modifying or creating any frontend code, components, or styles:
1. **Review Design Standards**:
   - Check [DESIGN.md](DESIGN.md) and the single source of truth [design-system/art-workspace/MASTER.md](design-system/art-workspace/MASTER.md).
   - Strictly follow Apple Human Interface Guidelines (HIG): clean typography, flat surfaces, 1px hairline borders (`border-black/[0.06]`), continuous squircle corner radii (`apple-lg` 18px cards/dialogs, `apple-md` 11px controls, `rounded-full` pills), and springy active states (`active:scale-[0.95]`).
2. **Consult UI/UX Pro Max**:
   - Use the installed `ui-ux-pro-max` skill (`.agent/skills/ui-ux-pro-max/`) for design intelligence, UX guidelines, accessibility requirements, and styling reference.
   - Run search queries via python when needed:
     ```bash
     py .agent/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
     ```
     *(Available domains: `style`, `product`, `typography`, `color`, `ux`, `chart`, `icons`, `motion`, `stack`)*
3. **shadcn/ui Composition**:
   - Consult `.agent/skills/shadcn/` before creating complex components. Use existing components and compose rather than inventing custom abstractions.
4. **Token Usage (Strict)**:
   - Never hardcode color hex codes directly in components.
   - Always consume CSS custom properties from `frontend/src/app/globals.css` via Tailwind arbitrary values (e.g., `bg-[var(--surface)]`, `text-[var(--ink)]`, `bg-[var(--accent)]`).
   - Respect light/dark mode and user accent settings (`data-theme`, `data-accent`).
5. **Accessibility & Usability**:
   - Every icon-only button must have an `aria-label` and visible focus ring.
   - Check WCAG contrast compliance and provide `prefers-reduced-motion` alternatives.
6. **Iconography & Logo Standards (Mandatory)**:
   - **UI & System Icons**: MUST use `lucide-react` (e.g., `import { Search, ChevronDown, Check, Settings, Trash2 } from 'lucide-react'`). Never create inline or custom SVGs for general UI controls.
   - **Brand, Social & Tech Logos**: MUST use `@icons-pack/react-simple-icons` (e.g., `import { SiGoogle, SiGithub, SiFacebook, SiLine, SiApple } from '@icons-pack/react-simple-icons'`). Never guess or draw logos manually.
   - Sizing: `w-4 h-4` (16px), `w-5 h-5` (20px), `w-6 h-6` (24px). Purely decorative icons require `aria-hidden="true"`. Global line weight `1.75` from `globals.css` applies to Lucide.

---

## 2. Backend & Data Layer Rules
1. **FastAPI Standards**:
   - Follow `.agent/skills/fastapi/`. Use `Annotated[..., Depends(...)]` for dependencies. Prefer return types over raw dicts.
2. **SQLModel Standards**:
   - Follow `.agent/skills/sqlmodel/`. Prefer `sqlmodel` imports (`Field`, `Session`, `select`) over raw SQLAlchemy declarative defaults. Keep migrations synced with Alembic.

---

## 3. General Code Quality
- Follow existing architecture: FastAPI backend (`backend/app`), Next.js 15 App Router frontend (`frontend/src/app`).
- Run relevant tests and type checks before reporting completion:
  - Frontend: `npm run test` (Vitest), `npm run type-check`
  - Backend: `pytest`, `flake8`, `mypy`, `alembic check`
