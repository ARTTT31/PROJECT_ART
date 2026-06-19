---
name: ART Workspace
description: A personal productivity dashboard consolidating tools, real-time widgets, and quick utilities into one calm workspace.
colors:
  primary: "#0ea5e9"
  primary-dark: "#0369a1"
  primary-light: "#38bdf8"
  blue: "#2563eb"
  ink: "#0f172a"
  muted: "#475569"
  shell: "#f6f8fb"
  success: "#22c55e"
  error: "#ef4444"
  warning: "#f59e0b"
  info: "#3b82f6"
  surface: "#ffffff"
  border-subtle: "#e2e8f0"
  border-strong: "#cbd5e1"
typography:
  display:
    fontFamily: "Anuphan, Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Anuphan, Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Anuphan, Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Anuphan, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Anuphan, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  card: "12px"
  input: "12px"
  button: "12px"
  badge: "9999px"
  dialog: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
  "3xl": "32px"
  "4xl": "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "12px 28px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
---

# Design System: ART Workspace

## 1. Overview

**Creative North Star: "The Clarity Cockpit"**

ART Workspace is a personal productivity dashboard that consolidates tools, real-time information, and quick utilities into a single calm interface. The design system prioritizes clarity over decoration: every element earns its place, information is instantly readable, and the interface stays out of the way of the user's work.

The aesthetic is clean, focused, and professional, inspired by premium macOS productivity apps. Glass effects are used sparingly as accent depth (header, sidebar, overlay modals), never as the default surface treatment for content cards. Surfaces are flat white with soft ambient shadows that create gentle tonal layering without visual noise.

This system explicitly rejects: dark mode (strictly light mode per anti-reference), cluttered dashboards where widgets compete for attention, flat lifeless interfaces that feel like spreadsheets, excessive decoration that doesn't serve the workflow, and inconsistent interaction patterns across widgets.

**Key Characteristics:**
- Light mode only, with a cool blue-tinted neutral palette (slate family)
- Soft tonal layering through ambient shadows, not glassmorphism
- Fixed rem typography scale (1.2 ratio) with Anuphan/Inter
- Refined components with standard radii (12px), not over-rounded
- Thai language throughout, with natural Buddhist calendar year support
- Purposeful motion: 150-250ms transitions, no bounce or elastic easing

## 2. Colors

The palette is restrained: a single sky-blue accent carries primary actions and active states, set against cool slate neutrals. Color is used for information and emphasis, never decoration.

### Primary
- **Sky Signal** (#0ea5e9): Primary actions, active navigation states, focus rings, and selection indicators. Used on ≤10% of any given screen.
- **Deep Sky** (#0369a1): Hover and pressed states for primary actions. Provides depth without shifting hue.
- **Light Sky** (#38bdf8): Rare accent for progress indicators and informational highlights.

### Secondary
- **True Blue** (#2563eb): Gradient endpoint for primary button. Used only in the primary button gradient, nowhere else independently.

### Neutral
- **Ink** (#0f172a): Body text, headings, primary content. The darkest tone for maximum contrast (≥7:1 on white).
- **Muted** (#475569): Secondary text, descriptions, metadata. Passes WCAG AA at 4.6:1 on white.
- **Shell** (#f6f8fb): Page background base. A barely-there cool tint that reads as clean white.
- **Surface** (#ffffff): Cards, inputs, and elevated surfaces. Pure white for clear tonal separation from the shell background.
- **Border Subtle** (#e2e8f0): Dividers, card borders, inactive boundaries. Visible but quiet.
- **Border Strong** (#cbd5e1): Active input borders, emphasized boundaries.

### Semantic
- **Success** (#22c55e): Confirmations, positive states, active toggles.
- **Error** (#ef4444): Validation errors, destructive actions, warning states.
- **Warning** (#f59e0b): Caution states, pending actions.
- **Info** (#3b82f6): Informational messages, help text.

### Named Rules
**The One Accent Rule.** Sky blue (#0ea5e9) is the only accent color. It appears on primary actions, active states, and focus indicators. No other hue competes for the "interactive" role. Gradient endpoints (True Blue) are supporting players, never standalone accents.

**The Slate-Only Rule.** All neutral text and surfaces use the slate family. The gray palette is prohibited. This ensures the cool blue undertone is consistent across every screen.

## 3. Typography

**Display Font:** Anuphan (with Inter, system-ui fallback)
**Body Font:** Anuphan (with Inter, system-ui fallback)

**Character:** A single typeface family carries the entire interface. Anuphan provides clean Thai character rendering alongside Latin glyphs, with Inter as the Latin fallback for environments where Anuphan isn't loaded. The result is a unified, professional voice that works across both scripts.

### Hierarchy
- **Display** (700, 2rem, 1.25 line-height): Page titles only. Used sparingly on the 404 page and admin header. `text-wrap: balance` for even line lengths.
- **Headline** (700, 1.75rem, 1.25 line-height): Section headings within pages. `text-wrap: balance`.
- **Title** (600, 1.25rem, 1.35 line-height): Card titles, widget headers, dialog titles.
- **Body** (400, 1rem, 1.65 line-height): Primary content text. Max line length 75ch. `text-wrap: pretty` to reduce orphans.
- **Label** (600, 0.875rem, 1.5 line-height): Form labels, sidebar section titles, metadata, badges. Never uppercase.

### Named Rules
**The Fixed Scale Rule.** Typography uses a fixed rem scale (1.2 ratio between steps), not fluid clamp. Product UIs are viewed at consistent DPI; fluid headings that shrink in sidebars look worse, not better. The scale: 12px → 14px → 16px → 18px → 20px → 24px → 28px → 32px.

**The No-Uppercase Rule.** Labels and section titles use sentence case with `font-weight: 600`. Never `text-transform: uppercase` on body copy or multi-word labels. Reserve uppercase for single-word badges only.

## 4. Elevation

This system uses soft tonal layering. Surfaces are flat white at rest, lifted gently by ambient shadows when they need to stand above the shell background. Glass effects (backdrop-blur, semi-transparent white) are reserved for exactly three surfaces: the sticky header, the sidebar, and overlay modals. Content cards, form panels, and widget containers use flat white with ambient shadows.

### Shadow Vocabulary
- **Glass Small** (`0 2px 8px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.02)`): Inputs and small interactive elements at rest.
- **Glass Medium** (`0 8px 32px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)`): Cards and content containers at rest.
- **Glass Large** (`0 16px 48px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)`): Hover state for interactive cards, dropdown menus.
- **Glass XL** (`0 24px 64px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.05)`): Modals and overlay panels.

### Named Rules
**The Flat-at-Rest Rule.** Content cards are flat white with a Glass Medium shadow. No backdrop-blur, no gradient border masks, no shimmer pseudo-elements on standard content cards. The glass treatment (backdrop-blur + semi-transparent background + gradient border) is reserved for the header, sidebar, and modal overlays only.

**The Lift-on-Hover Rule.** Interactive cards lift 2px on hover (`translateY(-2px)`) with a shadow transition to Glass Large. Duration: 200ms with `cubic-bezier(0.4, 0, 0.2, 1)`. Non-interactive cards (stat displays, read-only panels) do not lift.

## 5. Components

### Buttons
- **Shape:** Rounded rectangle (12px radius). Not pill-shaped except for badges/tags.
- **Primary:** Sky Signal (#0ea5e9) to True Blue (#2563eb) gradient, white text, 12px 28px padding. Shadow: `0 4px 16px rgba(14,165,233,0.25)`. On hover: lifts 2px, shadow intensifies. On active: returns to rest position, shadow reduces.
- **Hover / Focus:** `translateY(-2px)` with deeper shadow. Focus ring: 2px solid primary with 2px offset.
- **Secondary:** White background, subtle border (#e2e8f0), muted text (#475569). On hover: border shifts to primary color, background tints to shell, text shifts to primary-dark. Subtle 1px lift.
- **Destructive:** Error red (#ef4444) background at 90% opacity, white text. Used only for password changes and account deletion. No gradient, no blur, no shimmer. Just the color.
- **Minimum height:** 48px for all button variants (touch target compliance).

### Cards / Containers
- **Corner Style:** Rounded rectangle (12px radius). Never 24px or 28px.
- **Background:** Pure white (#ffffff).
- **Shadow Strategy:** Glass Medium at rest, Glass Large on hover (interactive only).
- **Border:** None by default. Optional 1px solid border-subtle (#e2e8f0) for cards that need visual separation without shadow.
- **Internal Padding:** 20-24px for content cards. 16px for compact cards (stat tiles, list items).
- **No pseudo-elements.** No `::before` gradient border masks, no `::after` shimmer overlays on standard cards. The glass pseudo-elements (`.premium-card::before`, `::after`) are deprecated for content cards.

### Inputs / Fields
- **Style:** 1.5px solid border (#cbd5e1), white background, 12px radius, 52px min-height.
- **Focus:** Border shifts to primary color, 4px primary glow ring (`rgba(14,165,233,0.12)`), background stays white.
- **Error:** Border shifts to error red, 4px error glow ring.
- **Disabled:** 50% opacity, light gray background (#f1f5f9), cursor: not-allowed.
- **Placeholder:** Slate-400 (#94a3b8), font-weight 500.

### Navigation
- **Sidebar:** Fixed left panel (256px), white background with subtle radial gradient overlay. Section labels: 11px bold, slate-500. Nav items: 14px semibold, 44px min-height, 12px radius. Active state: sky-500/10% background tint, sky-700 icon.
- **Header:** Sticky top, glass treatment (backdrop-blur 24px, white/70% background). Breadcrumb navigation with slate-500 text. User menu: avatar circle with gradient background (sky-500 to blue-700).
- **Mobile:** Sidebar slides in from left with transform, dark overlay (black/40%) behind.

### Widget Container
- **Style:** Standard card (white, 12px radius, Glass Medium shadow).
- **Header:** Icon badge (32px, sky-100 bg, sky-600 icon) + title + subtitle. Widget-specific controls (refresh, resize toggle) aligned right.
- **Body:** Flexible content area with appropriate padding per widget type.
- **Resize:** Three sizes (full, 2/3, 1/2) controlled by WidgetSizeToggle component.

### Chips / Badges
- **Style:** Pill shape (9999px radius), tinted background with matching text color.
- **Variants:** Sky (sky-50/sky-700), Violet (violet-50/violet-700), Success (green-50/green-700), Error (red-50/red-700), Neutral (slate-200/slate-600).

## 6. Do's and Don'ts

### Do:
- **Do** use 12px border-radius for cards, inputs, and buttons. This is the single standard radius for all rectangular elements.
- **Do** use the slate color family exclusively for all neutral text and surfaces. Every `text-gray-*` should be `text-slate-*`.
- **Do** use Lucide icons consistently across all components. Every icon should be a Lucide React component.
- **Do** keep card surfaces flat white with ambient shadows. Let the shadow vocabulary do the elevation work.
- **Do** reserve glass treatment (backdrop-blur + semi-transparent background) for header, sidebar, and modal overlays only.
- **Do** use `text-wrap: balance` on all headings (h1-h3) and `text-wrap: pretty` on body paragraphs.
- **Do** maintain 48px minimum height on all interactive elements (buttons, inputs, nav items) for touch target compliance.
- **Do** use Thai language for all user-facing copy. Use Buddhist year (+543) for calendar displays.
- **Do** provide `prefers-reduced-motion` alternatives for every animation. Default to crossfade or instant transition.
- **Do** use the semantic z-index scale: dropdown (50), sticky (100), modal (1000), toast (1100). Never arbitrary values.

### Don't:
- **Don't** apply glassmorphism (backdrop-blur, semi-transparent white, gradient border masks) to content cards, form panels, or widget containers. Glass is for overlays only.
- **Don't** use border-radius larger than 16px on any rectangular element. 24px and 28px radii make elements look inflated. Full-pill (9999px) is for badges and tags only.
- **Don't** use the `gray-*` Tailwind palette. Always use `slate-*` for cool-tinted neutrals consistent with the design tokens.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts.
- **Don't** use bounce, elastic, or wobble easing on any animation. Use exponential ease-out curves (`cubic-bezier(0.4, 0, 0.2, 1)` or `ease-out-quart`).
- **Don't** implement dark mode. The system is strictly light mode per the product anti-reference. Remove any `@media (prefers-color-scheme: dark)` queries.
- **Don't** mix icon libraries. Use Lucide React exclusively. Remove all Bootstrap icon (`bi bi-*`) references.
- **Don't** pair `border: 1px solid` with `box-shadow` blur ≥16px on the same element. Pick one: a clean border OR a defined shadow.
- **Don't** use decorative gradients on buttons beyond the primary button gradient. Destructive and secondary buttons are flat.
- **Don't** use the hero-metric template (big number + small label + icon + description) for statistics displays. Use compact inline layouts instead.
