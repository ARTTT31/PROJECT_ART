# ART Workspace — Design System Master Document

**Version:** 4.1 (Apple HIG & SF Symbols Standard - Web/Desktop Focus)
**Last Updated:** 2026-09-14
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
- **Interactive Blue:** `#0071e3` (Web CTA)
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

### 4. Iconography Style
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

## 🌍 Localization

- **Primary language:** Thai throughout.
- **Date format:** Buddhist calendar (CE + 543) for local displays.
- **Font:** Anuphan handles Thai script rendering properly.

---

## 📋 Pre-Delivery Checklist

- [ ] UI consistently uses `#0071e3` for primary actions (Apple Blue).
- [ ] UI consistently uses `#f5f5f7` for page backgrounds and `#ffffff` for cards.
- [ ] Corner radius values follow the squircle radii (`24px` for large cards, `12px` for buttons).
- [ ] Typography uses Anuphan for Thai, structured for clean layouts.
- [ ] Layout is optimized for Web and Desktop experiences.
