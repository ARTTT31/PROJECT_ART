# Design System

## Visual Direction

ART Workspace uses a restrained premium product UI: light surfaces, soft depth, clear focus states, and a limited sky-blue accent for primary actions and selected states. All design decisions are governed by the single source of truth at `design-system/art-workspace/MASTER.md`.

## Color

- Primary: `--art-primary` (`#0ea5e9`) — primary actions, active states, focus rings.
- Deep Sky: `#0369a1` — hover and pressed states.
- Ink: `--art-ink` (`#0f172a`) — body text and headings (7:1 contrast, WCAG AAA).
- Muted: `--art-muted` (`#475569`) — secondary labels and metadata (4.5:1 contrast).
- Surfaces: pure white `#ffffff` for cards and inputs; `#f6f8fb` for the page background.
- State colors: success `#22c55e`, error `#ef4444`, warning `#f59e0b`, info `#3b82f6`.
- Neutral palette: `slate-*` family **only** — `gray-*` is prohibited throughout the codebase.

## Typography

Font stack: **Anuphan** (primary, supports Thai script) + **Inter** (Latin fallback) + `system-ui`.

Scale (1.2 modular ratio):

| Role | Weight | Size | Usage |
|---|---|---|---|
| Display | 700 | 2rem | Page titles only |
| Headline | 700 | 1.75rem | Section headings |
| Title | 600 | 1.25rem | Card titles, widget headers |
| Body | 400 | 1rem | Primary content |
| Label | 600 | 0.875rem | Form labels, metadata |

Rules: sentence case only (no `text-transform: uppercase`); `text-wrap: balance` for headings; max 75ch line length for body.

## Buttons

All product buttons use the shared vocabulary defined in `frontend/src/app/globals.css`.

- `art-primary-button`: Main commit action — submit, save, download, current primary flow.
- `art-soft-button`: Secondary action, neutral command, lower-emphasis action.
- `art-icon-button`: Icon-only controls — close, menu, profile photo, password visibility.
- `art-chip-button`: Filter, segmented option, compact toggle, widget size selector.
- `action-btn`: Legacy alias that follows the same base button system.
- `refresh-btn` / `weather-refresh-btn`: Icon action variants inheriting the same sizing and motion.

Button rules:

- Radius: 12px for standard and icon buttons; `rounded-full` for chips.
- Minimum touch target: 48×48px for all interactive elements.
- Hover: 1px lift with restrained shadow increase.
- Active: returns to the base plane (no lift).
- Primary buttons use a sky→blue gradient sparingly.
- Do not create one-off button shapes unless a control has a distinct native affordance.
- Login-specific classes (`login-submit`, `google-btn`) must visually match `art-primary-button` and `art-soft-button`.
- Icon-only controls must include an `aria-label` and a visible focus ring.
- Toggle, filter, and segmented controls must use `art-chip-button` with `aria-pressed`.

## Dialogs (Radix UI)

All modal dialogs use `components/ui/Dialog.tsx`, which wraps Radix UI `@radix-ui/react-dialog` primitives with the ART design system styles.

Usage pattern — always use the declarative subcomponent API:

```tsx
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogBody
} from '@/components/ui/Dialog'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="!max-w-lg">
    <DialogHeader>
      <DialogTitle>ชื่อ Dialog</DialogTitle>
      <DialogDescription>คำอธิบายสั้น ๆ</DialogDescription>
    </DialogHeader>
    <DialogBody>
      {/* scrollable content */}
    </DialogBody>
    <DialogFooter>
      {/* actions */}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Dialog rules:

- Never pass `title` or `description` as props directly to `<DialogContent>`.
- The close button (X) is built in — do not add a duplicate.
- Max border radius: 16px (`rounded-xl`).
- Glassmorphism (backdrop blur) applies to the overlay only, not the content panel.
- WCAG AAA: focus trap, ESC key, and focus restoration to trigger element are automatic.

## Notifications, Alerts, Toasts, and Modals

- In-app toasts: use the `useToast()` hook from `components/Toast/ToastProvider`.
- Confirm / alert dialogs: use the wrappers in `frontend/src/utils/sweetalert.ts` (`showDeleteConfirm`, `showSuccess`, `showError`, `showToast`).
- SweetAlert2 is styled globally — never pass per-call `confirmButtonColor` or `cancelButtonColor`. Use `buttonsStyling: false` with shared custom classes.
- Confirm buttons match `art-primary-button`; cancel/deny match `art-soft-button`; destructive confirms add `art-swal-danger`.
- Error banners use `.alert-error`, `.alert-success`, `.alert-warning`, or `.alert-info` semantic classes.
- Avoid excessive blur, oversized radius, decorative gradients, and animated effects that do not communicate state.

## Drag and Drop (dnd-kit)

Widget reordering on the dashboard uses `@dnd-kit/core` and `@dnd-kit/sortable`. Sensor configuration uses `PointerSensor` with a minimum activation distance to prevent accidental drags on click. `KeyboardSensor` is included for keyboard accessibility.

## Authentication (AuthProvider)

Session management is centralized in `components/Auth/AuthProvider.tsx`:

- Fast-path render from `localStorage` / cookie on mount; background session and profile sync run in parallel via `Promise.all`.
- `401` responses dispatch a global `auth-logout` event — all components react without prop drilling.
- `validateSession()` is exposed via `useAuth()` for on-demand server-side session checks.
- `login()`, `logout()`, `updateUser()` are stable `useCallback` references safe to include in `useEffect` dependency arrays.

## Components

Widget configuration rows use selected-state cards with icon, label, helper text, status badge, and a visible checkmark. Filters and widget sizing use `art-chip-button` so compact controls feel connected to the wider button system.

## Motion

- Fast: 150ms — color shifts, opacity changes.
- Standard: 200ms — transforms, shadow transitions.
- Slow: 250ms — complex animations.
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (exponential ease-out). Never use bounce or elastic.
- Always provide `prefers-reduced-motion` alternatives (cross-fade or instant).

## Accessibility

- Body text contrast: ≥7:1 (Ink on white, WCAG AAA).
- Secondary text contrast: ≥4.5:1 (Muted on white).
- All interactive elements: 48×48px minimum touch target.
- Focus ring: 2.5px solid `#0ea5e9`, 3px offset, 7:1 contrast.
- Icon-only buttons: `aria-label` required.
- Toggle and segmented controls: `aria-pressed` required.
- Dialogs: focus trap, ESC key, and focus restoration are handled by Radix UI primitives.
