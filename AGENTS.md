# AGENTS.md — AI Agent Instructions & Guidelines

Welcome to **ART Workspace**. Whenever you interact with or modify this codebase, you MUST adhere to the following guidelines before taking any action.

---

## 🧭 Automatic Skill Routing Matrix

Before modifying or creating any code, AI agents MUST identify the relevant area and consult the installed skill in `.agent/skills/`:

| Domain / Task | Target Files / Scope | Mandatory Skills to Check & Follow |
| :--- | :--- | :--- |
| **Workflow & Discipline** | Any new feature, debugging, planning, reviews | `.agent/skills/using-superpowers/` (`brainstorming`, `writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`) |
| **UI/UX & Design Intelligence** | `frontend/src/**/*`, styles, pages | `.agent/skills/ui-ux-pro-max/` (via `py scripts/search.py`) + [`DESIGN.md`](DESIGN.md) + [`MASTER.md`](design-system/art-workspace/MASTER.md) |
| **UI Components & Radix/Tailwind** | `frontend/src/components/**/*` | `.agent/skills/shadcn/` (shadcn/ui composition, CLI, Radix primitives) |
| **PWA, Service Workers & Caching** | `frontend/public/manifest*`, `sw.*`, offline logic | `.agent/skills/pwa-development/` (Workbox, caching strategies, offline-first) |
| **Backend API & Endpoints** | `backend/app/api/**/*`, `backend/app/main.py` | `.agent/skills/fastapi/` (Routing, dependencies with `Annotated`, streaming/SSE) |
| **Database & ORM Models** | `backend/app/models/**/*`, `backend/app/db/**/*` | `.agent/skills/sqlmodel/` (SQLModel field definitions, sessions, query patterns) |
| **Design Tokens & Specs Architecture** | `frontend/src/app/globals.css`, token configs | `.agent/skills/design-system/` (Three-layer tokens: primitive → semantic → component) |
| **Brand Identity & Voice** | Branding, tone, copy, logo assets | `.agent/skills/brand/` + `.agent/skills/design/` (Visual identity, CIP mockups) |
| **Banners, Share Cards & Visuals** | Infographic cards, social banners, canvas export | `.agent/skills/banner-design/` + `.agent/skills/ui-styling/` |
| **HTML Slides & Presentations** | Presentation decks, reports, Chart.js views | `.agent/skills/slides/` |

---

## 🎯 Mandatory Pre-Flight Checklist for UI/UX & Frontend

Before writing, modifying, or refactoring ANY frontend page, component, or style:

1. **Review Design Source of Truth**:
   - Master document: [`design-system/art-workspace/MASTER.md`](design-system/art-workspace/MASTER.md)
   - Summary & principles: [`DESIGN.md`](DESIGN.md)
   - Adhere strictly to **Apple Human Interface Guidelines (HIG)**:
     - **Radii**: 18px (`apple-lg` / `rounded-[18px]`) for cards/dialogs, 11px (`apple-md`) for controls/inputs, `rounded-full` for chips/pills.
     - **Surfaces**: Flat surfaces with 1px hairline borders (`border-black/[0.06]`), no card drop-shadows (drop shadow is reserved only for product imagery).
     - **Feedback**: Springy active state (`active:scale-[0.95]`) on click/press, subtle hover shifts without lifting.

2. **Query UI/UX Pro Max Intelligence (`uupm.cc`)**:
   - The project includes the **`ui-ux-pro-max`** design skill at `.agent/skills/ui-ux-pro-max/`.
   - Before implementing new UI components, layouts, or data visualizations, search the local design database:
     ```bash
     py .agent/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
     # Domains: style, color, chart, landing, product, ux, typography, icons, gsap, react, web, google-fonts
     ```
   - For React/Next.js stack guidance:
     ```bash
     py .agent/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack nextjs
     ```

3. **Compose with `shadcn`**:
   - Consult `.agent/skills/shadcn/`.
   - Use existing components and compose rather than inventing custom abstractions from scratch.

4. **Strict Color & Token Policy**:
   - **DO NOT** hardcode hex colors (e.g. `#ffffff`, `#1d1d1f`, `#0066cc`) in component JSX/TSX.
   - Always consume CSS custom properties from `frontend/src/app/globals.css` using Tailwind arbitrary syntax:
     - Backgrounds: `bg-[var(--surface)]`, `bg-[var(--surface-grouped)]`
     - Text: `text-[var(--ink)]`, `text-[var(--ink-secondary)]`, `text-[var(--ink-muted)]`
     - Accents: `bg-[var(--accent)]`, `text-[var(--accent)]`, `hover:bg-[var(--accent-hover)]`
     - Borders: `border-[var(--hairline)]`
   - Ensure components gracefully handle light mode, dark mode, and dynamic user accent colors (`data-theme`, `data-accent`).

5. **Accessibility (a11y) & Usability**:
   - Icon-only buttons MUST include an `aria-label` and visible focus states.
   - Text contrast must meet WCAG AA standards.
   - Dialogs must use `components/ui/Dialog.tsx` (built on Radix UI).
   - In-app toasts must use `useToast()` from `components/Toast/ToastProvider`.

6. **Iconography & Logo Standards (Mandatory)**:
   - **UI & System Icons**: MUST use `lucide-react` (e.g. `import { Search, ChevronDown, Check, Settings, Trash2 } from 'lucide-react'`). Never create custom or inline SVGs for standard UI actions/controls.
   - **Brand, Social & Tech Logos**: MUST use `@icons-pack/react-simple-icons` (e.g. `import { SiGoogle, SiGithub, SiFacebook, SiLine, SiApple } from '@icons-pack/react-simple-icons'`). Never hand-craft or guess brand logos.
   - **Styling & Sizing**:
     - Standard sizes: `w-4 h-4` (16px), `w-5 h-5` (20px), or `w-6 h-6` (24px).
     - Stroke width: Governed globally by `globals.css` (`svg.lucide { stroke-width: 1.75 }`). Do not pass ad-hoc `strokeWidth` props.
     - Purely decorative icons placed alongside text must have `aria-hidden="true"`.

7. **Next.js 15, React 19 & Tailwind v4 Guardrails (Strict)**:
   - **Next.js 15 Async APIs**: Page/layout `params` and `searchParams` are Promises — MUST use `const { id } = await params`. Never access `params.id` synchronously.
   - **Async Headers & Cookies**: `cookies()` and `headers()` from `next/headers` are asynchronous (`await cookies()`).
   - **React 19 Primitives**: Pass `ref` directly as a component prop; do NOT wrap function components in `forwardRef`. Use `useActionState` instead of deprecated `useFormState`.
   - **Tailwind CSS v4 Architecture**: This project uses Tailwind v4 via `@import 'tailwindcss';` and `@config "../../tailwind.config.mts"` in `globals.css`. Never create a legacy `tailwind.config.js` or use deprecated `@tailwind base;` directives.

---

## ⚡ Backend, Database & PWA Standards

1. **FastAPI & Async Patterns**:
   - Consult `.agent/skills/fastapi/`.
   - Use `Annotated[..., Depends(...)]` for dependencies. Prefer explicit return types.
2. **SQLModel & Database**:
   - Consult `.agent/skills/sqlmodel/`.
   - Define models with `SQLModel, table=True` and `Field()`.
   - Keep migrations consistent with Alembic (`alembic check`).
3. **PWA & Offline-First**:
   - Consult `.agent/skills/pwa-development/`.
   - Follow Workbox caching strategies (CacheFirst for static assets, NetworkFirst/StaleWhileRevalidate for APIs).

---

## 🏗️ Architecture Overview & Verification

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Radix UI, `@dnd-kit`.
- **Backend**: Python 3.11 / 3.14, FastAPI, SQLAlchemy / SQLModel, Alembic, Pydantic v2.
- **Verification Commands**:
  - Frontend: `npm run test` (Vitest), `npm run type-check`, `npm run lint`.
  - Backend: `pytest`, `flake8`, `mypy`, `alembic check`.

Always verify and test your changes before concluding any task.

---

## 🧠 Core Engineering & Communication Principles

### 1. Ponytail Principle (Senior Minimalism & Anti-Bloat)
- **Check Existing Code First**: Always search the codebase for existing utilities, components, or patterns before writing new ones. Never duplicate existing functionality.
- **Platform & Standard Library First**: Leverage built-in Web APIs, standard libraries, and existing project dependencies. Do NOT install new npm or pip packages without explicit necessity and justification.
- **Do the Least Work Correctly**: Write the minimal amount of surgical code required to solve the task safely. Avoid premature abstractions, speculative features, unnecessary wrapper layers, and code bloat.

### 2. Caveman Principle (High-Signal, Zero-Fluff Communication)
- **Direct & Concise**: Cut out conversational filler, pleasantries, repetitive greetings, and lengthy preambles.
- **Focus on Actionable Facts**: Highlight what was investigated, what was changed (with file links), and test/verification proof.
- **Efficient Delivery**: "Why use many tokens when few tokens do trick." Keep responses dense, sharp, and structured.
