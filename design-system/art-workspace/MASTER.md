# ART Workspace — Design System Master Document

**Version:** 4.2 (Apple HIG & SF Symbols Standard - Web/Desktop Focus)
**Last Updated:** 2026-10-05
**Philosophy:** Apple Human Interface Guidelines (HIG) — Clean typography, SF Symbols iconography, macOS materials & translucency, dynamic system colors, continuous squircle radii, and intuitive interactive states.

---

## 🎯 Global Source of Truth

This document defines the strict rules for **ART Workspace**. All components, pages, and features MUST adhere to Apple HIG principles for Web.

---

## 🎨 Apple Human Interface Guidelines Principles

### 1. Typography & Hierarchy
- **Font Stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Anuphan, Inter, system-ui, sans-serif`
- **Scale:**
  - Large Title: 34pt (`text-apple-large-title font-bold tracking-[-0.03em]`)
  - Title 1: 28pt (`text-apple-title1 font-bold tracking-[-0.025em]`)
  - Title 2: 22pt (`text-apple-title2 font-bold tracking-[-0.02em]`)
  - Title 3: 20pt (`text-apple-title3 font-semibold tracking-[-0.015em]`)
  - Headline: 17pt (`text-apple-headline font-semibold tracking-[-0.015em]`)
  - Body: 17pt / 15pt (`text-apple-body` / `text-apple-subheadline`)
  - Callout: 16pt (`text-apple-callout`)
  - Footnote / Caption: 13pt / 12pt (`text-apple-footnote` / `text-apple-caption1`)

### 2. Apple System Colors
- **Interactive Blue:** `#0066cc` (Apple Action Blue — Web CTA). Focus/hover `#0071e3`; on dark surfaces use `#2997ff`.
- **No decorative gradients** and **no shadows on cards/buttons/text** — the only drop-shadow is for product imagery.
- **Semantic Tints:**
  - Green: `#34c759`
  - Orange: `#ff9500`
  - Red: `#ff3b30`
  - Purple: `#af52de`
  - Indigo: `#5856d6`
  - Teal: `#30b0c7`
- **System Grays:**
  - Gray 1: `#8e8e93`, Gray 2: `#aeaeb2`, Gray 3: `#c7c7cc`, Gray 4: `#d1d1d6`, Gray 5: `#e5e5ea`, Gray 6: `#f2f2f7`
- **Backgrounds:**
  - Primary Background: `#f5f5f7` (Grouped layout)
  - Card Surfaces: `#ffffff` (Flat, 1px hairline border `border-black/[0.06]` — no card shadow)
  - Translucent Panels: `rgba(255, 255, 255, 0.82)` with `backdrop-blur-2xl`

### 3. Continuous Squircle Corner Radii
The scale is **four values, nothing else**. Tailwind's named radii (`rounded-xl`, `rounded-2xl`, `rounded-lg`) are retired: they resolve to 12/16/8px and quietly reintroduced a fifth scale.

- **Cards / Widgets / Dialogs / Sheets:** `18px` (`rounded-[18px]`)
- **Medium surfaces** (grouped rows, popovers, hero strips): `14px` (`rounded-[14px]`)
- **Controls** (buttons, inputs, chips, icon tiles): `11px` (`rounded-[11px]`)
- **Pills, badges, segmented controls, switches:** `rounded-full`

### 4. Iconography Style
- **System & UI Controls:** `lucide-react` (e.g. `import { Search, ChevronDown, Check, Settings } from 'lucide-react'`).
  - Consistent line weight: one global rule sets `svg.lucide { stroke-width: 1.75 }`. Do **not** pass `strokeWidth` per icon; use `stroke-[2]` only when an icon must read heavier at 11–13px.
  - Tinted squircle icon badge containers (`bg-[#0066cc]/10 text-[#0066cc]`, etc.)
  - Enclosed icon buttons with springy click feedback (`active:scale-[0.95]`)
- **Brand & Tech Logos:** `@icons-pack/react-simple-icons` (e.g. `import { SiGoogle, SiGithub, SiLine, SiApple } from '@icons-pack/react-simple-icons'`).
  - Use official brand icons for third-party integrations, OAuth, external quick links, and social platforms.
  - Maintain color integrity or use `--ink` / `--ink-muted` tokens for monochrome representations.

### 5. Motion
- Durations: `150ms` interactions (`duration-apple-1`), `200ms` state/panel changes (`duration-apple-2`), `300ms` layout moves (`duration-apple-3`). No other values.
- Curves: `ease-apple` (`cubic-bezier(0.25, 0.1, 0.25, 1)`) for fades and colours, `ease-apple-spring` for the switch knob and press feedback.
- Every animation must survive `prefers-reduced-motion` (already handled globally in `globals.css`).

### 6. Layout & Rhythm
- Page content is capped at `max-w-[1280px]`; Apple keeps reading width near 1200px instead of filling the monitor.
- 8pt spacing rhythm; page bottom padding is deliberate (`pb-16 lg:pb-20`) so the last widget is not glued to the viewport edge.

---

## 🔤 Typography

**Font Stack:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', Inter, Anuphan, system-ui, sans-serif`  
(SF Pro / system serve Latin; **Anuphan** is the Thai fallback and stays primary for Thai script.)

### Scale

The ramp is closed: **11 / 12 / 13 / 14 / 15 / 16 / 17 / 20 / 22 / 28**. `text-[9px]`, `text-[10.5px]`, `text-[11.5px]`, `text-[12.5px]` and friends are gone — sub-11px text fails the HIG caption floor and made the UI read cramped.

| Role | Size | Weight | Line Height | Context |
|---|---|---|---|---|
| **Large Title** | 28px (`text-apple-title1`) | 600 (semibold) | 1.21 | `<PageHeader>` — exactly one `<h1>` per page |
| **Title 2** | 22px (`text-apple-title2`) | 600 | 1.27 | Hero card headings, mobile large title |
| **Headline** | 17px (`text-apple-headline`) | 600 | 1.41 | Compact title in the app header, dialog titles |
| **Body** | 15px (`text-apple-subheadline`) | 400 | 1.33 | Paragraphs, dialog copy |
| **Footnote** | 13px (`text-apple-footnote`) | 400/600 | 1.38 | Metadata, helper text, controls |
| **Caption 1** | 12px (`text-apple-caption1`) | 500/600 | 1.33 | Labels, badges, table cells |
| **Caption 2** | 11px (`text-apple-caption2`) | 600 | 1.27 | Smallest allowed text: chips, footnotes, timestamps |

**Heading ownership:** a page's only `<h1>` lives in the page's large title (`<PageHeader>`, or a hero card wired through `usePageHeading`). The app header shows a compact copy of that title, marked `aria-hidden`, which fades in once the large title scrolls under the bar.

---

## 🌍 Localization

- **Primary language:** Thai throughout.
- **Date format:** Buddhist calendar (CE + 543) for local displays.
- **Font:** Anuphan handles Thai script rendering properly.

---

## 📋 Pre-Delivery Checklist

- [ ] UI consistently uses `#0066cc` for primary actions (Apple Action Blue).
- [ ] UI consistently uses `#f5f5f7` for page backgrounds and `#ffffff` for cards.
- [ ] Corner radius values follow the scale (`18px` for cards/dialogs, `11px` for buttons/inputs, pill for CTAs).
- [ ] Typography uses Anuphan for Thai, structured for clean layouts.
- [ ] Layout is optimized for Web and Desktop experiences.
