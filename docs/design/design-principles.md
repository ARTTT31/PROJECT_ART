# Design System: ART Workspace — DEPRECATED

> [!WARNING]
> **DEPRECATED (2026-10-05).** This document described an older sky-blue / slate
> design system (accent `#0ea5e9`, primary-button gradient, `translateY` hover lift,
> `12px` radii, "no radius > 16px"). ART Workspace now follows **Apple Human Interface
> Guidelines**. The single source of truth is `design-system/art-workspace/MASTER.md`
> (v4.2), summarized in `DESIGN.md`. Treat the rules below as historical only.

## Current tokens (canonical)

| Role | Value |
|---|---|
| Primary accent | `#0066cc` (Apple Action Blue); hover/focus `#0071e3`; on dark surfaces `#2997ff` |
| Page background | `#f5f5f7` |
| Card surface | `#ffffff` with a hairline border `border-black/[0.06]` — no card shadow |
| Text | ink `#1d1d1f`, muted `#6e6e73` |
| Radius | cards/dialogs `18px`, controls `11px`, CTAs/pills `rounded-full` |
| Depth | flat surfaces + hairline borders; exactly one product-image shadow; press = `scale(0.95)` |
| Type | SF Pro / system for Latin, **Anuphan** for Thai |

## What changed

- **Accent:** sky `#0ea5e9` + blue gradient → solid `#0066cc` (no gradients anywhere).
- **Buttons:** gradient fill + glow shadow + `translateY(-2px)` hover lift → flat fill,
  no shadow, press `scale(0.95)`.
- **Cards:** glass vocabulary and hover lift → flat white with a hairline border and a
  single soft elevation; blur is reserved for transient overlays and the sticky header/sidebar.
- **Radius:** flat `12px` everywhere → Apple scale `5 / 8 / 11 / 18 / pill`.
- **Neutrals:** slate family → Apple ink/muted and the `#f5f5f7` parchment background.
- **Layout and density are unchanged** — this is a visual-language change, not a restructure.
