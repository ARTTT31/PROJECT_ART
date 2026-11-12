# AI Settings & Notifications UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the user interfaces of "เชื่อมต่อ AI" (AI Services) and "การแจ้งเตือน" (Notifications) into modern, clean, Apple HIG-compliant experiences with interactive provider cards, model chips, and channel tabs.

**Architecture:**
- **AI Settings (`AISettingsCard.tsx`)**: Replace dropdown with visual provider cards (Google Gemini vs OpenAI-compatible), add quick model preset chips, add direct external API key helper link, and redesign connection status banner.
- **In-App & Push Notifications (`NotificationSettingsCard.tsx`)**: Reformat into a cohesive Apple HIG inset grouped card with hairline dividers and polished switches.
- **External Notifications (`ExternalNotificationCard.tsx`)**: Replace the long vertical 3-channel form with a segmented channel switcher (`[LINE]`, `[Telegram]`, `[Webhook]`) with live connection badges.
- **Daily Briefing (`DailyBriefingCard.tsx`)**: Polish topic toggle buttons and delivery time pills with crisp HIG styling.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Lucide React, Simple Icons, Vitest.

## Global Constraints
- Strictly adhere to Apple HIG: `rounded-apple-lg` (18px) for cards, `rounded-apple-md` (11px) for controls, `active:scale-[0.98]` feedback, hairline borders (`border-[var(--hairline)]`).
- Strictly consume theme tokens (`var(--surface)`, `var(--ink)`, `var(--accent)`), never hardcode custom hexes (except brand colors).
- Use `lucide-react` for system icons and `@icons-pack/react-simple-icons` for brand logos (`SiGooglegemini`, `SiLine`, `SiTelegram`).
- All 61 existing test files must pass.

---

## Tasks

### Task 1: Overhaul AISettingsCard UI
**Files:**
- `frontend/src/components/Profile/AISettingsCard.tsx`
- `frontend/src/components/Profile/AISettingsCard.test.tsx`

- [ ] **Step 1: Inspect and update AISettingsCard component**
  - Replace `<Select>` provider dropdown with 2 visual selectable cards (Google Gemini with `SiGooglegemini`, OpenAI with `Cpu`/`Bot` icon).
  - Add quick model chips:
    - Gemini: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`
    - OpenAI: `gpt-4o-mini`, `gpt-4o`, `claude-3-5-sonnet`
  - Add "ขอรับ API Key ฟรีที่ Google AI Studio" external link when Gemini is selected.
  - Redesign status banner with status pill and quick test button.
- [ ] **Step 2: Run AISettingsCard test**
  `npm --prefix frontend test src/components/Profile/AISettingsCard.test.tsx`
- [ ] **Step 3: Commit changes**
  `git commit -m "feat(profile): modernize AI settings card with provider cards and model chips"`

---

### Task 2: Modernize ExternalNotificationCard with Channel Tabs
**Files:**
- `frontend/src/components/Profile/ExternalNotificationCard.tsx`

- [ ] **Step 1: Implement segmented channel tabs**
  - Add tabs: `line` (LINE Notify/Webhook), `telegram` (Telegram Bot), `webhook` (Custom Webhook).
  - Add connection status dot / badge on each tab (e.g., green dot if token is saved).
  - Display only the active channel's configuration form.
  - Event checkboxes and Save button remain clearly positioned at the bottom.
- [ ] **Step 2: Type check and test**
  `npm --prefix frontend run type-check`
- [ ] **Step 3: Commit changes**
  `git commit -m "feat(profile): streamline external notification channels into segmented tabs"`

---

### Task 3: Polish NotificationSettingsCard & DailyBriefingCard Styling
**Files:**
- `frontend/src/components/Profile/NotificationSettingsCard.tsx`
- `frontend/src/components/Profile/DailyBriefingCard.tsx`

- [ ] **Step 1: Polish NotificationSettingsCard into Apple Inset Grouped layout**
  - Clean rows for Web Push, Bell Sound, Holiday alerts, Personal reminders with consistent spacing and hairline borders.
- [ ] **Step 2: Polish DailyBriefingCard topic chips and time selector**
  - Ensure topic chips have clear active/inactive visual feedback and responsive layout.
- [ ] **Step 3: Run Profile component test suite**
  `npm --prefix frontend test src/components/Profile`
- [ ] **Step 4: Commit changes**
  `git commit -m "style(profile): polish in-app notification rows and briefing cards"`

---

### Task 4: Complete Verification Suite
**Files:**
- Entire frontend test suite

- [ ] **Step 1: Run full Vitest suite**
  `npm --prefix frontend test`
- [ ] **Step 2: Run TypeScript type check**
  `npm --prefix frontend run type-check`
- [ ] **Step 3: Run ESLint**
  `npm --prefix frontend run lint`
- [ ] **Step 4: Commit and push**
  `git push origin main`
