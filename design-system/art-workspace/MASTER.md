# ART Workspace — Design System Master Document

**Version:** 2.0
**Last Updated:** 2026-07-02
**Philosophy:** "Apple Showcase DNA" — Premium, spacious, typography-led product surfaces

---

## 🎯 Global Source of Truth

This document defines the strict rules for **ART Workspace**. All components, pages, and features MUST adhere to these principles unless a specific page override exists in `design-system/art-workspace/pages/[page].md`.

**v2.0 shift:** The system moves from a dense dashboard aesthetic ("Clarity Cockpit") to an Apple-inspired product showcase aesthetic. Bento-grid containers, oversized display typography, color-field tiles, and generous whitespace are now the standard — not exceptions.

---

## ⛔ Strict Anti-Patterns (NEVER DO)

### 1. Color Family Violations
❌ **NEVER** use the `gray-*` Tailwind palette
✅ **ALWAYS** use the `slate-*` family for neutral UI text/borders
✅ **ALWAYS** use `#1d1d1f` / `#6e6e73` / `#f5f5f7` for Apple-style surfaces and display copy

```css
/* WRONG */
.text-gray-500 / .bg-gray-100

/* CORRECT — neutral UI */
.text-slate-500 / .bg-slate-100

/* CORRECT — Apple display surfaces */
color: #1d1d1f;        /* Apple Ink — headings */
color: #6e6e73;        /* Apple Muted — body/description */
background: #f5f5f7;   /* Apple Gray — section alternation */
```

### 2. Dark Mode Violations
❌ **NEVER** implement dark mode
❌ **NEVER** use `@media (prefers-color-scheme: dark)`
✅ **ALWAYS** design for light mode only

### 3. Border Radius Violations
❌ **NEVER** use borders alone to define card boundaries — use bg-fill contrast
✅ **Bento tiles / feature cards:** `28px–32px` (`rounded-[28px]` or `rounded-[32px]`)
✅ **Standard UI cards / widgets:** `16px` (`rounded-2xl`) — raised from v1 12px
✅ **Dialogs / modals:** `20px` (`rounded-[20px]`)
✅ **Buttons (standard):** `12px` (`rounded-xl`)
✅ **Nav pills / badges:** `9999px` (`rounded-full`)
✅ **Inputs:** `12px` (`rounded-xl`)

```css
/* WRONG — old dashboard style, too tight */
.rounded-xl   /* 12px — now only for buttons/inputs */

/* CORRECT — card/widget standard */
.rounded-2xl  /* 16px */

/* CORRECT — bento tile standard */
.rounded-[28px] or .rounded-[32px]
```

### 4. Glassmorphism Abuse
❌ **NEVER** apply glassmorphism to content cards, bento tiles, or widgets
✅ **ONLY** use glass treatment for: Header, Sidebar, Modal Overlays

### 5. Icon Library Violations
❌ **NEVER** use Bootstrap Icons (`bi bi-*`)
✅ **ALWAYS** use Lucide React exclusively

### 6. Border-Defined Cards
❌ **NEVER** use a thin border as the only visual separator for a bento tile
✅ **ALWAYS** define tile boundaries through background fill contrast:
- Dark tile: `bg-[#1d1d1f]`
- Color tile: gradient `from-[...] to-[...]`
- White tile on gray section: `bg-white ring-1 ring-black/[0.06]`

### 7. Typography Anti-Patterns
❌ **NEVER** use `text-transform: uppercase` for body or heading copy
❌ **NEVER** use font sizes below `text-sm` (13px) for interactive labels
❌ **NEVER** use display heading sizes inside dense data tables or compact widgets
✅ **Sentence case** for all copy

---

## 🎨 Design Tokens

### Colors — Two-Layer System

#### Layer 1: Apple Display Surfaces (showcase pages, heroes, bento tiles, section headers)
| Token | Value | Usage |
|---|---|---|
| `--apple-ink` | `#1d1d1f` | Hero headings, tile headings |
| `--apple-muted` | `#6e6e73` | Body copy, descriptions, subheadings |
| `--apple-bg` | `#f5f5f7` | Section alternation background |
| `--apple-surface` | `#ffffff` | White tile on gray section |
| `--apple-blue` | `#0071e3` | CTA buttons, primary actions |
| `--apple-blue-hover` | `#0077ed` | CTA hover state |

#### Layer 2: ART UI Controls (inputs, nav, data widgets, system components)
| Token | Value | Usage |
|---|---|---|
| `--art-primary` | `#0ea5e9` | Focus rings, active states, links |
| `--art-primary-dark` | `#0369a1` | Hover on sky-blue controls |
| `--art-ink` | `#0f172a` | Body text in data-dense contexts |
| `--art-muted` | `#475569` | Secondary labels, metadata |
| `--art-shell` | `#f5f5f7` | Page background (aligned with Apple bg) |

#### Semantic (unchanged)
| Token | Value |
|---|---|
| `--art-success` | `#22c55e` |
| `--art-error` | `#ef4444` |
| `--art-warning` | `#f59e0b` |
| `--art-info` | `#3b82f6` |

#### Bento Tile Palette — Approved Gradients
These are the only approved color-field backgrounds for bento tiles. Do not invent new tile colors outside this set.

| Name | Gradient | Usage |
|---|---|---|
| Indigo-Violet | `from-[#4776e6] to-[#8e54e9]` | Calendar, featured content |
| Cobalt-Navy | `from-[#0575e6] to-[#021b79]` | Security, system |
| Orange-Red | `from-[#f09819] to-[#ff512f]` | Energy, alerts, highlights |
| Violet-Purple | `from-[#667eea] to-[#764ba2]` | Communication, messages |
| Midnight | `bg-[#1d1d1f]` | Team, settings, dark feature |
| White (ring) | `bg-white ring-1 ring-black/[0.06]` | Neutral content on gray section |

---

## 🔤 Typography

**Font Stack:** `Anuphan, SF Pro Display, Inter, system-ui, sans-serif`
- Anuphan covers Thai script
- SF Pro Display is a system fallback on Apple devices (no license needed)
- Inter covers Latin on non-Apple systems

### Scale

| Role | Size | Weight | Tracking | Line Height | Context |
|---|---|---|---|---|---|
| **Hero Display** | 56–68px (responsive) | 800 (extrabold) | `-0.03em` | 1.05 | Page hero h1 only |
| **Section Display** | 40–48px | 800 | `-0.025em` | 1.08 | Section h2 headings |
| **Tile Heading** | 28–32px | 800 | `-0.02em` | 1.1 | Bento tile titles |
| **Card Title** | 20–24px | 700 | `-0.015em` | 1.2 | Feature card titles |
| **UI Label** | 15px | 600 | `-0.01em` | 1.3 | Widget headers, nav |
| **Body** | 17–19px | 400 | `0` | 1.6 | Paragraph copy |
| **Caption** | 13px | 500 | `0` | 1.4 | Metadata, timestamps |
| **Data** | 13–14px | 400–500 | `0` | 1.4 | Tables, dense widgets |

### Rules
- `text-balance` on all headings
- `max-w-[60ch]` for body paragraphs on showcase pages, `75ch` for data-dense pages
- No `text-transform: uppercase` — use `font-semibold` weight instead
- Hero h1 uses `font-extrabold tracking-[-0.03em]` — this is the showcase standard

---

## 📐 Border Radius Reference

| Context | Value | Tailwind |
|---|---|---|
| Bento tile (large) | 32px | `rounded-[32px]` |
| Bento tile (small) | 28px | `rounded-[28px]` |
| UI card / widget | 16px | `rounded-2xl` |
| Dialog / modal | 20px | `rounded-[20px]` |
| Icon badge in tile | 18px | `rounded-[18px]` |
| Icon badge in card | 14px | `rounded-[14px]` |
| Button (standard) | 12px | `rounded-xl` |
| Button (CTA / pill) | 9999px | `rounded-full` |
| Input | 12px | `rounded-xl` |
| Badge / tag | 9999px | `rounded-full` |

---

## 📏 Spacing

Section padding on showcase pages uses generous vertical rhythm:
- **Hero section:** `py-24` (96px top/bottom)
- **Grid/bento section:** `py-28` (112px)
- **CTA / closing section:** `py-32` (128px)
- **Tile internal padding:** `p-8` to `p-10` (32–40px)
- **Card internal padding:** `p-5` to `p-6` (20–24px)
- **Max content width:** `max-w-[1024px] mx-auto`

---

## 🧩 Component Rules

### Bento Tiles
- Background defines the tile — no borders on colored tiles
- White tiles on gray sections: `bg-white ring-1 ring-black/[0.06]`
- Icon at top-left in a `rounded-[16–18px]` badge with `bg-white/20 backdrop-blur-md` on color tiles, `bg-[#f5f5f7]` on white tiles
- Heading and body copy at **bottom** of tile — tiles breathe upward
- Min height: `320px` small tiles, `420px` large hero tiles
- Hover: `-translate-y-1 transition-all duration-200` (subtle lift)

### Buttons
- **CTA Primary:** `rounded-full bg-[#0071e3] text-white hover:bg-[#0077ed]` — Apple blue pill
- **Standard UI:** `rounded-xl` with sky gradient — existing `art-primary-button`
- **Nav pill active:** `rounded-full bg-[#1d1d1f] text-white`
- **Nav pill default:** `rounded-full text-[#424245] hover:bg-black/[0.06]`
- **Min touch target:** 48×48px (all interactive elements)

### Navigation (Header)
- `sticky top-0 z-[100]`
- Background: `bg-[rgba(255,255,255,0.82)] backdrop-blur-2xl`
- Border: `border-b border-black/[0.08]`
- Height: `h-[52px]`
- Max width: `max-w-[1024px] mx-auto`

### Cards (Data Widgets)
- `rounded-2xl` (16px) — raised from v1's 12px
- `bg-white ring-1 ring-black/[0.06]` — no explicit border, ring instead
- Hover: `-translate-y-0.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]`
- Padding: `p-5` (20px)

### Dialogs (Radix UI)
All modal dialogs use `components/ui/Dialog.tsx`.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="!max-w-lg">
    <DialogHeader>
      <DialogTitle>ชื่อ Dialog</DialogTitle>
      <DialogDescription>คำอธิบายสั้น ๆ</DialogDescription>
    </DialogHeader>
    <DialogBody>{/* scrollable content */}</DialogBody>
    <DialogFooter>{/* actions */}</DialogFooter>
  </DialogContent>
</Dialog>
```

- Max radius: `rounded-[20px]` (updated from 16px)
- Glassmorphism on **overlay only** — never on content panel
- Built-in close button — do not add duplicate
- For dialogs with no visible header: use `<DialogTitleSR>` and `<DialogDescriptionSR>` sr-only variants

---

## ⚡ Motion & Interaction

### Timing
| Speed | Duration | Usage |
|---|---|---|
| Fast | 150ms | Color shifts, opacity |
| Standard | 200ms | Transforms, shadows, hover lifts |
| Slow | 250ms | Complex reveals |

- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` always
- Hover lift on tiles/cards: `-translate-y-0.5` to `-translate-y-1`
- Active: return to base plane (no lift)
- **NEVER:** bounce, elastic, wobble, orchestrated page-load sequences

### Reduced Motion
Always provide `prefers-reduced-motion` override:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
  }
}
```

---

## ♿ Accessibility (WCAG AA minimum, AAA for body text)

| Rule | Requirement |
|---|---|
| Body text contrast | ≥7:1 (`#1d1d1f` or `#0f172a` on white) |
| Secondary text | ≥4.5:1 (`#6e6e73` on white passes AA, not AAA — acceptable for non-body) |
| Interactive components | ≥3:1 |
| Touch targets | 48×48px minimum |
| Focus ring | `2.5px solid #0ea5e9`, `3px offset` |
| Icon-only buttons | `aria-label` required |
| Toggle/segmented | `aria-pressed` required |
| Progress bars | `role="progressbar"` with `aria-valuenow/min/max` |
| Nav active | `aria-current="page"` |
| Dialogs | Focus trap + ESC + restoration via Radix (automatic) |

---

## 🌍 Localization

- **Primary language:** Thai throughout
- **Date format:** Buddhist calendar (CE + 543)
- **Font:** Anuphan handles Thai script rendering

---

## 📋 Pre-Delivery Checklist

- [ ] NO `gray-*` classes (use `slate-*` for UI, `#1d1d1f`/`#6e6e73`/`#f5f5f7` for Apple surfaces)
- [ ] NO dark mode queries
- [ ] NO glassmorphism on tiles or cards (header/sidebar/modals only)
- [ ] NO Bootstrap icons — Lucide React only
- [ ] NO `title`/`description` props on `<DialogContent>` — use subcomponents
- [ ] NO `rounded-xl` on bento tiles — min `rounded-[28px]`
- [ ] Bento tile boundaries defined by bg-fill, NOT borders alone
- [ ] ALL buttons/inputs ≥48px touch target
- [ ] ALL focus states have visible 2.5px ring
- [ ] ALL text meets contrast requirements
- [ ] ALL animations respect `prefers-reduced-motion`
- [ ] ALL icon-only buttons have `aria-label`
- [ ] ALL `useEffect` hooks declare complete dependency arrays

---

## 🔄 Version History

| Version | Date | Changes |
|---|---|---|
| 2.0 | 2026-07-02 | Apple showcase DNA adopted as global standard. New radius scale, two-layer color system, display typography, bento tile rules, Apple nav spec, CTA button spec |
| 1.1 | 2026-07-02 | Add Dialog (Radix UI) rules; add react-hooks lint note |
| 1.0 | 2026-07-02 | Initial release |

---

## 📚 References

- Apple showcase page implementation: `frontend/src/app/apple-style/page.tsx`
- Page overrides: `design-system/art-workspace/pages/[page].md`
- CSS tokens: `frontend/src/app/globals.css`
