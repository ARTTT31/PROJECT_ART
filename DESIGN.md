# Design System

## Visual Direction

ART Workspace uses a refined Web/Desktop UI based on Apple Human Interface Guidelines: light surfaces, flat color fields, clear focus states, and the signature Apple blue accent for primary actions and selected states. All design decisions are governed by the single source of truth at `design-system/art-workspace/MASTER.md`.

## Color

Colours are declared once as CSS custom properties in `frontend/src/app/globals.css` and consumed through arbitrary Tailwind values (`bg-[var(--surface)]`, `text-[var(--ink-muted)]`, `bg-[var(--accent)]`). Do not hard-code a light-mode hex in a component: it would stay light in dark mode and ignore the accent the user picked.

- Accent: `--accent` (`#0066cc`, Apple Action Blue by default) — primary actions, active states, focus rings. `--accent-hover` is the hover tone, `--accent-text` is the accent used as text (brightened automatically in dark mode).
- Ink: `--ink` `#1d1d1f` — body text and headings. The lower-emphasis steps are contrast-tested, not decorative: `--ink-secondary` `#475569` (7.5:1), `--ink-muted` `#5f5f64` (6.3:1) and `--ink-tertiary` `#6e6e73` (5.0:1 on white, 4.7:1 on `--surface-grouped`) all clear WCAG AA at any text size. `--ink-faint` `#86868b` (3.6:1) is for icons and dividers only — never for copy.
- Surfaces: `--surface` `#ffffff` for cards and widgets, `--surface-grouped` `#f5f5f7` for the page background, plus `--surface-subtle`, `--surface-chip` and the `--glass-*` translucent fills.
- Hairlines: `--hairline`, `--hairline-soft`, `--hairline-strong` (they flip from black-alpha to white-alpha in dark mode).
- State colors: `--success` `#34c759`, `--danger` `#ff3b30`, `--warning` `#ff9500`, each with a `*-ink` text tone and a `*-soft` fill.

## Theme (light / dark + accent)

The user picks a mode and an accent in **โปรไฟล์ → ทางลัด & ปรับแต่งเมนู → ธีมและการแสดงผล**. The card writes `data-theme="light|dark"` and `data-accent="…"` on `<html>`; `globals.css` reacts to both. A pre-paint script in `app/layout.tsx` applies the saved choice before the first paint, so a dark reload never flashes white.

- Modes: `system` (follows `prefers-color-scheme`), `light`, `dark`. Default is `system`.
- Accents: ฟ้า (default), เขียวน้ำทะเล, คราม, ม่วง, ชมพู, ส้ม, เขียว, ดำเทา. Every accent keeps WCAG AA contrast with white button text.
- The choice is stored per browser (`localStorage: art_theme_settings`) — it is a display preference, not workspace data.
- Tailwind's pastel scales used by widgets (`bg-emerald-50`, `text-rose-700`, …) are re-toned inside `:root[data-theme='dark']`, so widget tints follow the theme without per-component classes.
- New components must use the tokens above; a hard-coded hex is a bug because it breaks both dark mode and accent switching.

## Typography

Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter` first for Latin, with **Anuphan** as the Thai fallback (SF Pro has no Thai glyphs). Anuphan stays primary for Thai script.

Rules: sentence case only; `text-wrap: balance` for headings; max 75ch line length for body.

## Surfaces, Depth & Shape

- No decorative gradients. Atmosphere comes from content, never CSS gradients.
- Elevation comes from surface color and hairline borders — not from shadows on cards, buttons, or text. Cards, widgets and settings panels carry no shadow at all, and nothing lifts or gains a shadow on hover.
- Shadows are allowed only where a surface floats above the page and needs to be separated from it: the Dialog, dropdown menus, popovers and toasts. Chips, tabs and switches use a 1px shadow at most, as their own control affordance.
- Exactly one drop-shadow exists for product imagery: `3px 5px 30px 0 rgba(0, 0, 0, 0.22)` (`shadow-apple-product`).
- Radius scale: `none` 0 / `apple-xs` 5px / `apple-sm` 8px / `apple-md` 11px / `apple-lg` 18px / `rounded-full` pill.
- Active/press state is `scale(0.95)` on buttons — no hover lift.

## Buttons

All product buttons follow the HIG specifications:

- Radius: 11px (`apple-md`) for standard and icon buttons; `rounded-full` for pills and chips.
- Hover: Subtle background shift to `#0071e3` — no shadow or lift.
- Active: `active:scale-[0.95]` for a springy native feel.
- Primary buttons use solid `#0066cc`.
- Icon-only controls must include an `aria-label` and a visible focus ring.
- Touch targets: 24×24 px is the floor for every control (WCAG 2.5.8, AA). The 44×44 Apple HIG size is applied only on coarse pointers (touch) through the `@media (pointer: coarse)` rule in `globals.css`; forcing it on desktop turned compact widget chips into 44px blocks.

## Iconography & Brand Logos

ART Workspace maintains strict iconography standards split between general UI controls and third-party brand logos:

1. **System & UI Icons (`lucide-react`)**:
   - Primary icon set for all interface actions, status markers, navigation, and controls.
   - Example: `import { Search, ChevronDown, Check, Settings, Trash2 } from 'lucide-react';`
   - Stroke width is centralized in `globals.css` (`svg.lucide { stroke-width: 1.75 }`). Avoid hardcoding `strokeWidth` inline.

2. **Brand, Social & Tech Logos (`@icons-pack/react-simple-icons`)**:
   - Official logos for third-party services, social networks, and technologies (Google, GitHub, Line, Facebook, Apple, Microsoft, etc.).
   - Example: `import { SiGoogle, SiGithub, SiLine, SiFacebook } from '@icons-pack/react-simple-icons';`
   - Never create makeshift custom SVGs or low-res images for external brand logos.

3. **Accessibility & Best Practices**:
   - Decorative icons beside text: specify `aria-hidden="true"`.
   - Standalone icon buttons: MUST provide an accessible name via `aria-label` and have an `active:scale-[0.95]` press state.

## Dialogs (Radix UI)

All modal dialogs use `components/ui/Dialog.tsx`, wrapping Radix UI `@radix-ui/react-dialog` with HIG styles.

Dialog rules:
- Border radius: `18px` (`rounded-[18px]`).
- The close button (X) is built in.
- Only the overlay uses backdrop blur; the dialog surface is flat white with a hairline ring.

## Notifications, Alerts, Toasts, and Modals

- In-app toasts: use the `useToast()` hook from `components/Toast/ToastProvider`.
- Confirm / alert dialogs: use the wrappers in `frontend/src/utils/sweetalert.ts`.
- Confirm buttons match primary button styling (`#0066cc`).

## Drag and Drop (dnd-kit)

Widget reordering on the dashboard uses `@dnd-kit/core` and `@dnd-kit/sortable`. Sensor configuration uses `PointerSensor` with a minimum activation distance to prevent accidental drags on click. 

## Authentication (AuthProvider)

Session management is centralized in `components/Auth/AuthProvider.tsx`.

## Motion

- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (exponential ease-out).
- Always provide `prefers-reduced-motion` alternatives.


## UI/UX Pro Max Intelligence (uupm.cc)

The workspace integrates **UI/UX Pro Max** (`.agent/skills/ui-ux-pro-max/`) for automated design intelligence, accessibility audits, and UI reference patterns.

Before writing or refactoring any UI component, AI agents should query the local database:
```bash
# General search syntax:
py .agent/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>

# Examples:
py .agent/skills/ui-ux-pro-max/scripts/search.py "minimalism" --domain style
py .agent/skills/ui-ux-pro-max/scripts/search.py "accessible button focus ring" --domain icons
py .agent/skills/ui-ux-pro-max/scripts/search.py "react" --domain stack
```

Key rules enforced alongside UI/UX Pro Max:
1. Always maintain token consistency with `design-system/art-workspace/MASTER.md` and `frontend/src/app/globals.css`.
2. Do not introduce decorative gradients or heavy drop shadows outside the defined Apple HIG tokens.
3. Keep layout responsive, accessible (WCAG AA), and tested in both Light and Dark modes.
