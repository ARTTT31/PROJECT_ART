# Design System

## Visual Direction

ART Workspace uses a refined Web/Desktop UI based on Apple Human Interface Guidelines: light surfaces, soft depth, clear focus states, and the signature Apple blue accent for primary actions and selected states. All design decisions are governed by the single source of truth at `design-system/art-workspace/MASTER.md`.

## Color

- Primary: `#0071e3` (Apple Blue) — primary actions, active states, focus rings.
- Hover State: `#0077ed` — button hover.
- Ink: `#1d1d1f` — body text and headings (high contrast).
- Muted: `#6e6e73` — secondary labels and metadata.
- Surfaces: pure white `#ffffff` for cards and widgets; `#f5f5f7` for the page background.
- State colors: success `#34c759`, error `#ff3b30`, warning `#ff9500`.

## Typography

Font stack: **Anuphan** (primary, supports Thai script) + **Inter** (Latin fallback) + `-apple-system, BlinkMacSystemFont`.

Rules: sentence case only; `text-wrap: balance` for headings; max 75ch line length for body.

## Buttons

All product buttons follow the HIG specifications:

- Radius: 12px for standard and icon buttons; `rounded-full` for pills and chips.
- Hover: Subtle background shift or shadow.
- Active: `active:scale-[0.98]` for a springy native feel.
- Primary buttons use solid `#0071e3`.
- Icon-only controls must include an `aria-label` and a visible focus ring.

## Dialogs (Radix UI)

All modal dialogs use `components/ui/Dialog.tsx`, wrapping Radix UI `@radix-ui/react-dialog` with HIG styles.

Dialog rules:
- Max border radius: `24px` (`rounded-[24px]`).
- The close button (X) is built in.
- Glassmorphism (backdrop blur) applies to the overlay only.

## Notifications, Alerts, Toasts, and Modals

- In-app toasts: use the `useToast()` hook from `components/Toast/ToastProvider`.
- Confirm / alert dialogs: use the wrappers in `frontend/src/utils/sweetalert.ts`.
- Confirm buttons match primary button styling (`#0071e3`).

## Drag and Drop (dnd-kit)

Widget reordering on the dashboard uses `@dnd-kit/core` and `@dnd-kit/sortable`. Sensor configuration uses `PointerSensor` with a minimum activation distance to prevent accidental drags on click. 

## Authentication (AuthProvider)

Session management is centralized in `components/Auth/AuthProvider.tsx`.

## Motion

- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (exponential ease-out).
- Always provide `prefers-reduced-motion` alternatives.
