# ART Workspace — Design System Master Document

**Version:** 3.0 (Enterprise Transition)
**Last Updated:** 2026-07-14
**Philosophy:** "Enterprise Admin DNA" — Structured, clean, information-dense, data-driven, and blue accent-led (Inspired by Ant Design Pro).

---

## 🎯 Global Source of Truth

This document defines the strict rules for **ART Workspace**. All components, pages, and features MUST adhere to these principles unless a specific page override exists.

**v3.0 shift:** The system moves from a spacious bento-grid display aesthetic ("Apple Showcase DNA") to a clean, structured, and information-dense enterprise admin interface. Clean white cards, light-grey backgrounds, sharp borders, compact spacing, and a focus-led blue theme are now the standard.

---

## ⛔ Strict Anti-Patterns (NEVER DO)

### 1. Color Family Violations
❌ **NEVER** use dark gray or neon background colors for main layout panels.
❌ **NEVER** use custom background gradients on basic UI elements or content cards (gradients are reserved for charts or alerts).
✅ **ALWAYS** use the `#f0f2f5` background for page layouts.
✅ **ALWAYS** use `#001529` for dark sidebar navigation.
✅ **ALWAYS** use Ant Design standard text hierarchy:
- Primary Text: `#000000e0` (85% opacity black for main text/labels)
- Secondary Text: `#00000073` (45% opacity black for descriptions/metadata)
- Disabled Text: `#00000040` (25% opacity black)

### 2. Spacing and Margin Over-sizing
❌ **NEVER** use oversized padding like `py-24` or `py-32` on dashboards.
❌ **NEVER** use massive display typography (> 36px) inside tables, forms, or widgets.
✅ **ALWAYS** keep layouts compact and structured (e.g., standard layout padding `p-6` or `p-4`).

### 3. Border Radius Violations
❌ **NEVER** use oversized border radius values like `28px`, `32px` or `rounded-[32px]` for widgets and panels.
✅ **Standard Cards / Widgets:** `8px` (`rounded-lg`)
✅ **Buttons / Inputs / Small controls:** `6px` (`rounded-md`)
✅ **Dialogs / Modals:** `8px` (`rounded-lg`)
✅ **Nav pills / badges:** `9999px` (`rounded-full` / pill badges)

### 4. Borderless Content Panels
❌ **NEVER** leave card boundaries undefined or reliant solely on soft drop shadows.
✅ **ALWAYS** use sharp, clean borders or rings: `border border-[#f0f0f0]` or `ring-1 ring-[#f0f0f0]` on white content surfaces.

### 5. Floating / Detached Headers
❌ **NEVER** use floating, glassmorphic headers.
✅ **ALWAYS** use a solid, top-pinned white header with a thin bottom border: `bg-white border-b border-[#f0f0f0]`.

---

## 🎨 Design Tokens

### Colors — Ant Design Scale

#### Layer 1: Global Theme & Accents
| Token | Value | Usage |
|---|---|---|
| `--ant-primary` | `#1677ff` | Primary buttons, active states, link colors |
| `--ant-primary-hover` | `#4096ff` | Hover states on primary controls |
| `--ant-primary-active` | `#0958d9` | Active/Pressed states |
| `--ant-bg-layout` | `#f0f2f5` | Main page background |
| `--ant-bg-container` | `#ffffff` | Card, container, and widget backgrounds |
| `--ant-border-color` | `#f0f0f0` | General divider and border color |

#### Layer 2: Text Colors (Dark on Light)
| Token | Value | Usage |
|---|---|---|
| `--ant-text-primary` | `rgba(0, 0, 0, 0.88)` | Primary headings, body copy, and form labels |
| `--ant-text-secondary` | `rgba(0, 0, 0, 0.45)` | Secondary metadata, descriptions, subtexts |
| `--ant-text-placeholder` | `rgba(0, 0, 0, 0.25)` | Form input placeholders |

#### Layer 3: Dark Sidebar Theme
| Token | Value | Usage |
|---|---|---|
| `--ant-sidebar-bg` | `#001529` | Dark menu background |
| `--ant-sidebar-text` | `rgba(255, 255, 255, 0.65)` | Unselected menu items |
| `--ant-sidebar-active-bg` | `#1677ff` | Active menu item highlight background |
| `--ant-sidebar-active-text` | `#ffffff` | Active menu item text color |

---

## 🔤 Typography

**Font Stack:** `Anuphan, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

### Scale

| Role | Size | Weight | Line Height | Context |
|---|---|---|---|---|
| **Page Heading** | 20px (`text-xl`) | 600 (semibold) | 1.4 | Page title / Page header |
| **Section Title** | 16px (`text-base`) | 600 | 1.5 | Widget headers, card titles |
| **UI Label** | 14px (`text-sm`) | 500/600 | 1.4 | Form labels, navigation items |
| **Body Text** | 14px (`text-sm`) | 400 | 1.5 | Paragraphs, metadata |
| **Data / Code** | 13px | 400 | 1.4 | Tables, lists, compact widgets |

---

## 📐 Border Radius Reference

| Context | Value | Tailwind |
|---|---|---|
| UI Card / Widget | 8px | `rounded-lg` |
| Dialog / Modal | 8px | `rounded-lg` |
| Buttons / Inputs | 6px | `rounded-md` |
| Badges / Tags | 4px | `rounded` |

---

## 🧩 Layout & Component Rules

### 1. Sidebar (Dark / Light Options)
- Default: Dark mode style (`bg-[#001529]`).
- Width: `w-64` (256px).
- Navigation links use vertical listing with Lucide icons on the left, label on the right.
- Active state uses a clear blue highlight background (`bg-[#1677ff]`) with white text, or soft blue tint background for light mode.

### 2. Header
- Solid white surface: `bg-white`.
- Fixed height: `56px` (`h-14`).
- Thin bottom border: `border-b border-[#f0f0f0]`.
- Displays Page Breadcrumbs on the left and User Actions (profile, search, notification bell) on the right.

### 3. Cards & Widgets
- Background: `bg-white`.
- Border: `border border-[#f0f0f0]`.
- Border Radius: `rounded-lg` (8px).
- Shadow: Subtle shadow `shadow-sm` or `shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]`.
- Internal Padding: `p-5` or `p-6` depending on content density.

### 4. Buttons
- **Primary:** `bg-[#1677ff] text-white hover:bg-[#4096ff] rounded-md transition-colors`.
- **Default:** `border border-[#d9d9d9] bg-white text-[rgba(0,0,0,0.88)] hover:text-[#4096ff] hover:border-[#4096ff] rounded-md`.

---

## 🌍 Localization

- **Primary language:** Thai throughout.
- **Date format:** Buddhist calendar (CE + 543) for local displays.
- **Font:** Anuphan handles Thai script rendering properly.

---

## 📋 Pre-Delivery Checklist

- [ ] NO floating glass headers or sidebar overlays (use solid backgrounds)
- [ ] NO `gray-*` classes for borders/backgrounds (use `#f0f2f5` and `#f0f0f0`)
- [ ] Corner radius values do not exceed 8px for containers/modals and 6px for buttons/inputs
- [ ] Primary buttons use `#1677ff` and secondary states use `#4096ff`
- [ ] Typography uses Anuphan for Thai, structured for data-dense layouts
- [ ] ALL forms follow Ant Design alignment and validation spacing
