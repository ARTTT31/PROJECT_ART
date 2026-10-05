# Design System

## Visual Direction

ART Workspace uses a refined Web/Desktop UI based on Apple Human Interface Guidelines: light surfaces, flat color fields, clear focus states, and the signature Apple blue accent for primary actions and selected states. All design decisions are governed by the single source of truth at `design-system/art-workspace/MASTER.md`.

## Color

- Primary: `#0066cc` (Apple Action Blue) — primary actions, active states, focus rings.
- Hover / Focus: `#0071e3` — button hover and keyboard focus.
- On dark surfaces: `#2997ff` (Sky Link Blue) for inline links.
- Ink: `#1d1d1f` — body text and headings (high contrast).
- Muted: `#6e6e73` — secondary labels and metadata.
- Surfaces: pure white `#ffffff` for cards and widgets; `#f5f5f7` for the page background.
- State colors: success `#34c759`, error `#ff3b30`, warning `#ff9500`.

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
