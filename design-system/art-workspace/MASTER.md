# ART Workspace — Design System Master Document

**Version:** 4.0 (Apple HIG & SF Symbols Standard)
**Last Updated:** 2026-07-14
**Philosophy:** Apple Human Interface Guidelines (HIG) — Clean typography, SF Symbols iconography, iOS/macOS materials & translucency, dynamic system colors, continuous squircle radii, and intuitive interactive states.

---

## 🎯 Global Source of Truth

This document defines the strict rules for **ART Workspace**. All components, pages, and features MUST adhere to Apple HIG principles.

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
- **Interactive Blue:** `#0071e3` (Web CTA) / `#007aff` (iOS Accent)
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
  - Card Surfaces: `#ffffff` (Elevated with diffuse multi-layer shadow and 1px border `border-black/[0.06]`)
  - Translucent Panels: `rgba(255, 255, 255, 0.82)` with `backdrop-blur-2xl`

### 3. Continuous Squircle Corner Radii
- **Hero / Bento Cards / Widgets:** `24px` – `28px` (`rounded-3xl` / `rounded-[28px]`)
- **Dialogs & Modals:** `24px` (`rounded-[24px]`)
- **Inputs & Small Controls:** `12px` – `14px` (`rounded-xl`)
- **Pills, Badges & Segmented Controls:** `9999px` (`rounded-full`)

### 4. SF Symbols Iconography Style
- Consistent line weight (`strokeWidth={1.75}`)
- Tinted squircle icon badge containers (`bg-[#0071e3]/10 text-[#0071e3]`, etc.)
- Enclosed icon buttons with springy click feedback (`active:scale-[0.98]`)

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
