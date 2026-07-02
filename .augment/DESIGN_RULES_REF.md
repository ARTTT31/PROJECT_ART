# UI/UX Design Rules — Project Reference

> **CRITICAL:** For ALL UI/UX design, component building, and front-end coding tasks,
> strictly read and adhere to the global rules defined in:
>
> **`design-system/art-workspace/MASTER.md`**
>
> Do NOT invent styles, palettes, icon libraries, or component patterns outside this single source of truth.

## Key Constraints (Quick Reference)

| Rule | Requirement |
|------|-------------|
| Color palette (UI controls) | `slate-*` only — NEVER `gray-*` |
| Color palette (showcase surfaces) | `#1d1d1f` / `#6e6e73` / `#f5f5f7` — Apple tokens |
| Mode | Light mode only — NO dark mode |
| Border radius — bento tiles | `rounded-[32px]` large, `rounded-[28px]` small |
| Border radius — UI cards/widgets | `rounded-2xl` (16px) |
| Border radius — buttons/inputs | `rounded-xl` (12px) |
| Border radius — nav pills / badges | `rounded-full` (9999px) |
| Tile boundaries | bg-fill contrast only — NO border-only cards |
| Icons | Lucide React exclusively — NO Bootstrap Icons |
| Glassmorphism | Header / Sidebar / Modals only — NOT on tiles or cards |
| Typography (showcase) | Anuphan + `font-extrabold tracking-[-0.03em]` for heroes |
| Typography (UI) | Anuphan (Thai) + Inter fallback, sentence case only |
| Accent color (CTA) | Apple Blue `#0071e3` for pill CTAs |
| Accent color (UI) | Sky Blue `#0ea5e9` for focus rings, active states |
| Touch targets | Min 48×48px |
| Contrast | WCAG AAA (7:1 body, 4.5:1 secondary) |
| Page background | `#f5f5f7` — aligned `--art-shell` and `--apple-bg` |

## Approved Bento Tile Gradients

| Name | Value |
|------|-------|
| Indigo-Violet | `from-[#4776e6] to-[#8e54e9]` |
| Cobalt-Navy | `from-[#0575e6] to-[#021b79]` |
| Orange-Red | `from-[#f09819] to-[#ff512f]` |
| Violet-Purple | `from-[#667eea] to-[#764ba2]` |
| Midnight | `bg-[#1d1d1f]` |
| White (on gray section) | `bg-white ring-1 ring-black/[0.06]` |

## CSS Utility Classes (globals.css)

| Class | Usage |
|-------|-------|
| `.apple-tile` | Bento tile wrapper — radius + hover lift |
| `.apple-heading-hero` | Hero h1 display type (48–68px) |
| `.apple-heading-section` | Section h2 (40–48px) |
| `.apple-heading-tile` | Tile h3 (28–32px) |
| `.apple-body` | Showcase body copy (17–19px, muted) |
| `.apple-btn-primary` | Blue pill CTA button |
| `.apple-btn-ghost` | Ghost pill secondary button |
| `.apple-nav` | Sticky translucent nav bar |
| `.apple-tile-icon` | Icon badge inside color tile (white/20) |
| `.apple-card-icon` | Icon badge inside white card (#f5f5f7) |

**Full rules → `design-system/art-workspace/MASTER.md`**
**Page overrides → `design-system/art-workspace/pages/[page].md`**
**Implementation reference → `frontend/src/app/apple-style/page.tsx`**
