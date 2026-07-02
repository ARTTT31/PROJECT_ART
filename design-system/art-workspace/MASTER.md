# ART Workspace - Design System Master Document

**Version:** 1.0  
**Last Updated:** 2026-07-02  
**Philosophy:** "The Clarity Cockpit" - Calm, focused, professional productivity interface

---

## 🎯 Global Source of Truth

This document defines the strict anti-patterns and design rules for **ART Workspace**. All components, pages, and features MUST adhere to these principles unless a specific page override exists in `design-system/art-workspace/pages/[page].md`.

---

## ⛔ Strict Anti-Patterns (NEVER DO)

### 1. Color Family Violations
❌ **NEVER** use the `gray-*` Tailwind palette  
✅ **ALWAYS** use the `slate-*` family exclusively for all neutral colors

```css
/* WRONG */
.text-gray-500
.bg-gray-100
.border-gray-300

/* CORRECT */
.text-slate-500
.bg-slate-100
.border-slate-300
```

### 2. Dark Mode Violations
❌ **NEVER** implement dark mode features  
❌ **NEVER** use `@media (prefers-color-scheme: dark)` queries  
✅ **ALWAYS** design for light mode only

```css
/* WRONG - Delete these */
@media (prefers-color-scheme: dark) {
  /* any dark mode styles */
}

.dark:bg-gray-900
```

### 3. Border Radius Violations
❌ **NEVER** use border-radius > 16px on rectangular elements  
✅ **Standard:** 12px for cards, buttons, inputs  
✅ **Modal:** 16px maximum  
✅ **Pills:** 9999px for badges/tags only

```css
/* WRONG */
.rounded-3xl  /* 24px - too inflated */
.rounded-2xl  /* 16px - only for dialogs */

/* CORRECT */
.rounded-xl   /* 12px - standard for cards/buttons/inputs */
.rounded-full /* 9999px - badges/tags only */
```

### 4. Glassmorphism Abuse
❌ **NEVER** apply glassmorphism to content cards, form panels, or widgets  
✅ **ONLY** use glass treatment for: Header, Sidebar, Modal Overlays

```css
/* WRONG - Don't use on content cards */
.backdrop-blur-xl
.bg-white/10

/* CORRECT - Only on header/sidebar/modals */
.header { backdrop-blur-2xl; background: rgba(255,255,255,0.7); }
```

### 5. Icon Library Violations
❌ **NEVER** use Bootstrap Icons (`bi bi-*`)  
❌ **NEVER** mix icon libraries  
✅ **ALWAYS** use Lucide React icons exclusively

```tsx
/* WRONG */
<i className="bi bi-heart"></i>

/* CORRECT */
import { Heart } from 'lucide-react'
<Heart className="w-5 h-5" />
```

---

## 🎨 Design Tokens

### Colors

#### Primary
- **Sky Signal:** `#0ea5e9` - Primary actions, active states, focus rings
- **Deep Sky:** `#0369a1` - Hover/pressed states
- **Light Sky:** `#38bdf8` - Progress indicators (rare)

#### Secondary
- **True Blue:** `#2563eb` - Gradient endpoint only (primary button)

#### Neutrals (Slate Family Only)
- **Ink:** `#0f172a` - Body text, headings (7:1 contrast)
- **Muted:** `#475569` - Secondary text, metadata (4.6:1 contrast)
- **Shell:** `#f6f8fb` - Page background base
- **Surface:** `#ffffff` - Cards, inputs, elevated surfaces
- **Border Subtle:** `#e2e8f0` - Dividers, card borders
- **Border Strong:** `#cbd5e1` - Active input borders

#### Semantic
- **Success:** `#22c55e` - Confirmations, positive states
- **Error:** `#ef4444` - Validation errors, destructive actions
- **Warning:** `#f59e0b` - Caution states
- **Info:** `#3b82f6` - Informational messages

### Typography

**Font Family:** Anuphan (primary), Inter (fallback), system-ui, sans-serif

#### Scale (Fixed rem, 1.2 ratio)
- **Display:** 700 weight, 2rem (32px), 1.25 line-height - Page titles only
- **Headline:** 700 weight, 1.75rem (28px), 1.25 line-height - Section headings
- **Title:** 600 weight, 1.25rem (20px), 1.35 line-height - Card titles, widget headers
- **Body:** 400 weight, 1rem (16px), 1.65 line-height - Primary content
- **Label:** 600 weight, 0.875rem (14px), 1.5 line-height - Form labels, metadata

#### Rules
- **NO UPPERCASE:** Use sentence case with semibold weight, never text-transform: uppercase
- **Text Wrap:** `balance` for headings, `pretty` for body paragraphs
- **Max Line Length:** 75ch for body text

### Border Radius
- **Standard:** `12px` - Cards, buttons, inputs
- **Dialog:** `16px` - Modals only
- **Badge:** `9999px` - Pills and tags
- **MAX:** Never exceed 16px on rectangular elements

### Spacing Scale
- **xs:** 4px
- **sm:** 8px
- **md:** 12px
- **lg:** 16px
- **xl:** 20px
- **2xl:** 24px
- **3xl:** 32px
- **4xl:** 40px

### Shadows (Ambient Tonal Layering)
- **Glass Small:** `0 2px 8px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.02)` - Inputs
- **Glass Medium:** `0 8px 32px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)` - Cards at rest
- **Glass Large:** `0 16px 48px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)` - Hover state, dropdowns
- **Glass XL:** `0 24px 64px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.05)` - Modals

---

## 🧩 Component Rules

### Buttons
- **Min Height:** 48px (touch target)
- **Radius:** 12px (standard)
- **Primary:** Sky Signal → True Blue gradient, white text, shadow
- **Secondary:** White bg, subtle border, muted text
- **Focus Ring:** 2.5px solid primary, 3px offset, 7:1 contrast

### Cards
- **Background:** Pure white `#ffffff`
- **Radius:** 12px
- **Shadow:** Glass Medium at rest, Glass Large on hover (interactive only)
- **Border:** None by default, optional 1px `border-subtle`
- **Padding:** 20-24px for content, 16px for compact

### Inputs
- **Min Height:** 52px
- **Radius:** 12px
- **Border:** 1.5px solid `border-strong`
- **Focus:** Primary border + 4px primary glow ring
- **Placeholder:** slate-400, font-weight 500

### Navigation
- **Sidebar:** 256px fixed, white bg, section labels 11px bold
- **Nav Items:** 44px min-height, 12px radius, sky-500/10% active
- **Header:** Sticky, glass treatment (backdrop-blur 24px)

### Widgets
- **Container:** Standard card (white, 12px radius, Glass Medium)
- **Header:** Icon badge + title + controls
- **Resize:** Three sizes (full, 2/3, 1/2)

---

## ⚡ Motion & Interaction

### Timing
- **Fast:** 150ms - Color shifts, opacity changes
- **Standard:** 200ms - Transforms, shadow transitions
- **Slow:** 250ms - Complex animations

### Easing
- **Default:** `cubic-bezier(0.4, 0, 0.2, 1)` - Exponential ease-out
- **NEVER:** bounce, elastic, wobble

### Reduced Motion
- **ALWAYS** provide `prefers-reduced-motion` alternatives
- Default to crossfade or instant transition

---

## ♿ Accessibility (WCAG AAA)

### Contrast
- **Body Text:** ≥7:1 (Ink on white)
- **Secondary Text:** ≥4.5:1 (Muted on white)
- **Interactive:** ≥3:1 for UI components

### Touch Targets
- **Minimum:** 48px height × 48px width for all interactive elements

### Focus Indicators
- **Ring:** 2.5px solid primary, 3px offset
- **Contrast:** 7:1 minimum

### Screen Reader
- Use semantic HTML
- Provide `aria-label` for icon-only buttons
- Maintain logical tab order

---

## 🌍 Localization

### Language
- **Primary:** Thai language throughout
- **Date Format:** Buddhist calendar (year + 543)

### Typography
- Anuphan supports Thai script rendering
- Inter fallback for Latin when needed

---

## 📋 Pre-Delivery Checklist

Before committing any component:

- [ ] NO `gray-*` classes (strictly `slate-*`)
- [ ] NO `rounded-2xl` or larger on rectangles (max 16px)
- [ ] NO dark mode queries (`@media (prefers-color-scheme: dark)`)
- [ ] NO glassmorphism on content cards (only header/sidebar/modals)
- [ ] NO Bootstrap icons (`bi bi-*`), only Lucide React
- [ ] ALL buttons/inputs ≥48px min-height
- [ ] ALL focus states have visible 2.5px ring
- [ ] ALL text meets WCAG AAA contrast (7:1 body, 4.5:1 secondary)
- [ ] ALL animations respect `prefers-reduced-motion`
- [ ] ALL interactive elements have proper touch targets

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-02 | Initial MASTER.md with strict anti-patterns |

---

## 📚 References

- Full Design Principles: `docs/design/design-principles.md`
- Liquid Glass UI: `docs/design/liquid-glass-ui.md`
- Accessibility Standards: `docs/design/accessibility.md`

---

**Remember:** This is the **Global Source of Truth**. Override only with page-specific rules in `pages/[page].md`. When in doubt, enforce these anti-patterns strictly.
