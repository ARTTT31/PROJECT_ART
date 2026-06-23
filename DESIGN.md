# Design System

## Visual Direction

ART Workspace uses a restrained premium product UI: light surfaces, soft depth, clear focus states, and a limited blue accent for primary actions and selected states.

## Color

- Primary: `--art-primary` (`#0ea5e9`) and `--art-blue` (`#2563eb`) for primary actions.
- Ink: `--art-ink` (`#0f172a`) for main text.
- Muted: `--art-muted` (`#475569`) for secondary labels.
- Surfaces: white and translucent white over `--art-page-bg`.
- State colors: success, warning, error, and info tokens in `frontend/src/app/globals.css`.

## Typography

Use the project font stack from Tailwind and keep product UI type compact. Button labels use normal letter spacing, semibold weight, and direct action text.

## Buttons

All product buttons should use the shared button vocabulary in `frontend/src/app/globals.css`.

- `art-primary-button`: Main commit action, submit, save, download, or current primary flow.
- `art-soft-button`: Secondary action, neutral command, menu trigger, or lower-emphasis action.
- `art-icon-button`: Icon-only action such as close, menu, profile photo, or password visibility.
- `art-chip-button`: Filter, segmented option, compact toggle, and widget size option.
- `action-btn`: Legacy alias that now follows the same base button system.
- `refresh-btn` and `weather-refresh-btn`: Icon action variants that inherit the same sizing and motion.

Button rules:

- Radius is 12px for standard and icon buttons; chips are pill-shaped.
- Minimum touch target is 44px for standard/icon buttons.
- Hover lifts by 1px with restrained shadow.
- Active state returns to the base plane.
- Primary buttons use the blue gradient sparingly.
- Do not create new one-off button shapes unless a control has a distinct native affordance.
- Login-specific classes such as `login-submit` and `google-btn` must visually match `art-primary-button` and `art-soft-button`.
- Icon-only controls must use `art-icon-button` or an intentional size variant, include an `aria-label`, and keep a visible focus ring.
- Toggle, filter, segmented, and compact state controls must use `art-chip-button` with `aria-pressed` for selected state.

## Notifications, Alerts, Toasts, And Modals

Notification surfaces use the same calm product system as buttons: white or lightly tinted state surfaces, 10-16px radius, restrained shadows, clear iconography, and readable contrast.

- In-app toasts use `.alert`, the semantic alert classes, and an `art-icon-button` close control.
- NotificationBell uses `art-icon-button` for the trigger and dismiss actions, `art-soft-button` for secondary actions, and compact semantic badges for state.
- Error banners and alert states use `.alert-error`, `.alert-success`, `.alert-warning`, or `.alert-info`; avoid local one-off alert colors unless introducing a new semantic token.
- Dialog modals use the shared surface, radius, shadow, focus trap, close button, and scroll behavior from `components/ui/Dialog.tsx`.
- Empty and error states should feel quiet and useful: a clear icon, direct heading, concise body text, and shared retry/navigation buttons.
- Avoid excessive blur, oversized radius, decorative gradients, and animated alert effects that do not communicate state.

## SweetAlert2

SweetAlert2 is styled through the wrapper in `frontend/src/utils/sweetalert.ts` and global classes in `frontend/src/app/globals.css`.

- Do not set per-call `confirmButtonColor` or `cancelButtonColor`; use `buttonsStyling: false` and the shared custom classes.
- Confirm buttons match `art-primary-button`; cancel and deny buttons match `art-soft-button`; destructive confirms add `art-swal-danger`.
- SweetAlert2 toast surfaces match the in-app toast scale, shadow, typography, and focus behavior.
- Loading and input alerts inherit the same popup, input, radius, typography, and focus tokens.

## Components

Widget configuration rows use selected-state cards with icon, label, helper text, status, and a visible checkmark. Filters and widget sizing use `art-chip-button` so compact controls still feel connected to the wider button system.

## Motion

Use short 180-200ms transitions for button feedback. Respect existing reduced-motion rules in `globals.css`.

## Accessibility

Maintain visible focus states, keep icon-only buttons labeled with `aria-label`, and use `aria-pressed` for toggle chips or segmented controls.
