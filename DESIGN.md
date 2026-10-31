# Design System

## Visual Direction

ART Workspace uses a refined Web/Desktop UI based on Apple Human Interface Guidelines: light surfaces, flat color fields, clear focus states, and the signature Apple blue accent for primary actions and selected states. All design decisions are governed by the single source of truth at `design-system/art-workspace/MASTER.md`.

## Color

Colours are declared once as CSS custom properties in `frontend/src/app/globals.css` and consumed through arbitrary Tailwind values (`bg-[var(--surface)]`, `text-[var(--ink-muted)]`, `bg-[var(--accent)]`). Do not hard-code a light-mode hex in a component: it would stay light in dark mode and ignore the accent the user picked.

- Accent: `--accent` (`#0066cc`, Apple Action Blue by default) — primary actions, active states, focus rings. `--accent-hover` is the hover tone, `--accent-text` is the accent used as text (brightened automatically in dark mode).
- Ink: `--ink` `#1d1d1f` — body text and headings; `--ink-secondary`, `--ink-muted` `#6e6e73`, `--ink-tertiary`, `--ink-faint` for lower emphasis.
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
- Elevation comes from surface color and hairline borders — not from shadows on cards, buttons, or text.
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
