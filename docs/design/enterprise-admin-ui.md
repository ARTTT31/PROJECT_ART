# 🎨 Enterprise Admin Design System - Ant Design Pro Style

## Overview
The ART Workspace design system is updated to follow the **Enterprise Admin DNA** inspired by the clean, data-dense, and structured patterns of Ant Design Pro.

---

## 🌟 Core Design Principles

### 1. Structured & Information-Dense Layouts
- Focus on clean tabular alignments, compact lists, and form flows.
- Standard container padding: `p-6` (24px) for desktop pages, `p-4` (16px) for mobile.
- Use spacing efficiently: avoid massive blank areas or overly tall margins.

### 2. Colors & Opacities
- **Primary Color:** `#1677ff` (Daybreak Blue / Ant Blue) for links, focus rings, primary CTA buttons, and active item highlights.
- **Page Layout Background:** `#f0f2f5` (Neutral light-grey background).
- **Component Containers (Cards, Modals):** `#ffffff` (Solid white background).
- **Borders & Dividers:** `#f0f0f0` (Light-grey border).
- **Text Scale:**
  - Primary Text: `rgba(0, 0, 0, 0.88)` (Primary headings, form labels, body text).
  - Secondary Text: `rgba(0, 0, 0, 0.45)` (Sub-labels, metadata, descriptions).
  - Disabled Text: `rgba(0, 0, 0, 0.25)`.

### 3. Sharp Border Radii
- **Widgets, Cards, Panels, Modals:** `8px` (`rounded-lg`).
- **Inputs, Buttons, Small controls:** `6px` (`rounded-md`).
- **Pills, Badges:** `9999px` (`rounded-full`).

### 4. Component Shadows
- Use very subtle, shallow shadows to define elevation instead of fuzzy dark glow:
  - Standard card shadow: `shadow-sm` or `shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]`.

---

## 🧩 Component Styles

### **Cards / Widgets**
- Background: `#ffffff`
- Borders: `1px solid #f0f0f0`
- Radius: `8px` (`rounded-lg`)
- Hover: Subtle translate elevation lift is prohibited; instead, apply transition to shadow: `transition-all duration-200 hover:shadow-md`.

### **Sidebar Navigation**
- Background: `#001529` (Midnight Navy) for high contrast and executive look.
- Selected menu items: Background `#1677ff` with white text.
- Standard menu items: Text `rgba(255, 255, 255, 0.65)` with hover color `#ffffff`.
- Width: `w-64` (256px).

### **Header (Top Navbar)**
- Solid white: `#ffffff`
- Height: `56px` (`h-14`)
- Bottom Border: `border-b border-[#f0f0f0]`
- Breadcrumb navigation on the left, profile and notifications actions on the right.

### **Buttons**

#### Primary Button
- Background: `#1677ff`
- Hover State: `#4096ff`
- Radius: `6px` (`rounded-md`)

#### Default Button
- Background: `#ffffff`
- Border: `1px solid #d9d9d9`
- Text: `rgba(0,0,0,0.88)`
- Hover: Text `#4096ff` and Border `#4096ff`

### **Inputs**
- Background: `#ffffff`
- Border: `1px solid #d9d9d9`
- Radius: `6px` (`rounded-md`)
- Focus ring: `2px solid #1677ff` with no offset.

---

## 🔤 Typography

**Font Stack:** `Anuphan, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Page Headings | 20px (`text-xl`) | 600 | 1.4 |
| Card Titles / Widget Headers | 16px (`text-base`) | 600 | 1.5 |
| UI Labels / Forms | 14px (`text-sm`) | 600 | 1.4 |
| Body Text / Data | 14px (`text-sm`) | 400 | 1.5 |

---

## ♿ Accessibility & Responsiveness

### **WCAG AA Compliance**
- Contrast ratio for body text must be at least 4.5:1.
- All icon-only elements must provide `aria-label`.
- Interactive touch target minimum is 44x44px.

### **Mobile Adaptation (<768px)**
- Sidebar transforms into a drawer overlay.
- Padding decreases to `p-4` to maximize screen real estate.
