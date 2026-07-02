# UI/UX Design Rules โ€” Project Reference

> **CRITICAL:** For ALL UI/UX design, component building, and front-end coding tasks,
> strictly read and adhere to the global rules defined in:
>
> **design-system/art-workspace/MASTER.md**
>
> Do NOT invent styles, palettes, icon libraries, or component patterns outside this single source of truth.

## Quick Constraints

| Rule | Requirement |
|------|-------------|
| Color palette | `slate-*` only โ€” NEVER `gray-*` |
| Mode | Light mode only โ€” NO dark mode |
| Border radius | Max 16px on rectangles (`rounded-xl` standard) |
| Icons | Lucide React exclusively โ€” NO Bootstrap Icons |
| Glassmorphism | Header / Sidebar / Modals only |
| Typography | Anuphan (Thai) + Inter fallback |
| Accent color | Sky Blue `#0ea5e9` |
| Touch targets | Min 48x48px |
| Contrast | WCAG AAA (7:1 body, 4.5:1 secondary) |

**Full rules:** `design-system/art-workspace/MASTER.md`
**Page overrides:** `design-system/art-workspace/pages/[page].md`
