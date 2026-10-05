# 🎨 Enterprise Admin Design System — DEPRECATED

> [!WARNING]
> **DEPRECATED (2026-10-05).** ART Workspace no longer uses the Ant Design Pro /
> "Enterprise Admin" style. The project follows **Apple Human Interface Guidelines**,
> defined in the single source of truth: `design-system/art-workspace/MASTER.md` (v4.2),
> summarized in `DESIGN.md`.

## Current tokens (canonical)

| Role | Value |
|---|---|
| Primary accent | `#0066cc` (Apple Action Blue); hover/focus `#0071e3`; on dark surfaces `#2997ff` |
| Page background | `#f5f5f7` |
| Card surface | `#ffffff` with a hairline border `border-black/[0.06]` — no card shadow |
| Text | ink `#1d1d1f`, muted `#6e6e73` |
| Radius | cards/dialogs `18px`, controls `11px`, CTAs/pills `rounded-full` |
| Depth | flat surfaces + hairline borders; exactly one product-image shadow; press = `scale(0.95)` |

The Ant Design values previously documented in this file — primary `#1677ff`,
background `#f0f2f5`, borders `#f0f0f0`, `rounded-lg` (8px) radii, navy sidebar
(`#001529`), and `#4096ff` hover — are **no longer used anywhere in the codebase**.
Do not follow them. Use `MASTER.md` instead.
