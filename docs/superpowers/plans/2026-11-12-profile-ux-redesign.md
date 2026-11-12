# Profile & Notifications UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the `/profile` page by eliminating double-stacked tabs in favor of a single-level Apple HIG segmented control, re-organizing miscategorized settings (moving Date/Language format to Appearance), and modernizing the Notifications section into clean, cohesive blocks.

**Architecture:** 
- Unify `/profile` navigation into 5 primary single-tier tabs (`profile`, `appearance`, `notifications`, `ai`, and admin-only `workspace`).
- Move `DateFormatCard` from alerts into `appearance` alongside `ThemeCard` and `QuickLinksCard`.
- Redesign the Notifications panel to present 3 clear functional blocks: In-App/Browser push alerts, Daily Morning Briefing, and External channels (LINE/Telegram/Webhook).
- Maintain complete URL query param synchronization (`?tab=...`) with backward compatibility for legacy links.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-profile-ux-redesign-design.md`

## Global Constraints
- Follow Apple HIG: 18px radii (`rounded-apple-lg`), flat surfaces with hairline borders (`border-[var(--hairline)]`), no card drop-shadows, springy active states (`active:scale-[0.98]`).
- Do not hardcode hex color codes; strictly consume CSS tokens from `globals.css` (e.g., `var(--surface)`, `var(--ink)`, `var(--accent)`).
- Icons must strictly use `lucide-react` for system UI and `@icons-pack/react-simple-icons` for brand logos.
- All 61 existing test files (396+ tests) and TypeScript type checks must pass without errors.

---

## Tasks

### Task 1: Update I18n Messages for Single-Tier Tabs
**Files:**
- `frontend/src/lib/i18n/messages.ts`
- `frontend/src/lib/i18n/messages.test.ts`

- [ ] **Step 1: Write failing test in `messages.test.ts` for updated profile tab keys**
- [ ] **Step 2: Run test to confirm it fails**
  `npm --prefix frontend test src/lib/i18n/messages.test.ts`
- [ ] **Step 3: Update `messages.ts` with new tab definitions (Thai & English)**
  - `profile.tab.profile`: ข้อมูลส่วนตัว / Personal & Security
  - `profile.tab.appearance`: การแสดงผล & เมนู / Appearance & Menu
  - `profile.tab.notifications`: การแจ้งเตือน / Notifications
  - `profile.tab.ai`: เชื่อมต่อ AI / AI Connection
  - `profile.tab.workspace`: พื้นที่ทำงาน / Workspace
- [ ] **Step 4: Re-run test to confirm it passes**
  `npm --prefix frontend test src/lib/i18n/messages.test.ts`
- [ ] **Step 5: Commit changes**
  `git commit -m "feat(i18n): update profile tab keys for single-tier navigation"`

---

### Task 2: Re-architect PreferencesPanels & Move DateFormatCard
**Files:**
- `frontend/src/components/Profile/PreferencesPanels.tsx`

- [ ] **Step 1: Update `PreferenceSection` type and card groupings**
  - Section keys: `'appearance' | 'notifications' | 'ai' | 'workspace'`
  - Under `appearance`: Group `ThemeCard`, `DateFormatCard`, `MainMenuCard` (admin), and `QuickLinksCard`.
  - Under `notifications`: Group `NotificationSettingsCard`, `DailyBriefingCard`, and `ExternalNotificationCard`.
  - Under `ai`: `AISettingsCard`.
  - Under `workspace`: `BrandingCard`, `CompanyHolidayCard`, `WorkspaceBackupCard`.
- [ ] **Step 2: Type-check to verify component contracts**
  `npm --prefix frontend run type-check`
- [ ] **Step 3: Commit changes**
  `git commit -m "refactor(profile): re-organize preference panels and move date format to appearance"`

---

### Task 3: Redesign Profile Page Navigation (Single-Tier Apple HIG Tabs)
**Files:**
- `frontend/src/app/(main)/profile/page.tsx`

- [ ] **Step 1: Replace double-stacked tabs with single-level segmented navigation bar**
  - Define tabs: `profile`, `appearance`, `notifications`, `ai`, `workspace` (conditional on `isAdmin`).
  - Remove redundant `SubNav` bar underneath.
  - Inside `profile` tab, keep a sleek sub-switch for `[ข้อมูลส่วนตัว] | [ความปลอดภัย]` so password/2FA/devices don't overcrowd personal info.
  - Update `handleTabChange` and URL sync to handle `tab=profile`, `tab=appearance`, `tab=notifications`, `tab=ai`, `tab=workspace` with backward compatibility for `tab=preferences`.
- [ ] **Step 2: Run type check and verify build integrity**
  `npm --prefix frontend run type-check`
- [ ] **Step 3: Commit changes**
  `git commit -m "feat(profile): implement single-tier segmented tab navigation"`

---

### Task 4: Polish & Modernize Notifications UI Blocks
**Files:**
- `frontend/src/components/Profile/NotificationSettingsCard.tsx`
- `frontend/src/components/Profile/DailyBriefingCard.tsx`
- `frontend/src/components/Profile/ExternalNotificationCard.tsx`

- [ ] **Step 1: Enhance `NotificationSettingsCard`**
  - Refine Web Push, bell sound, holiday, and personal reminder rows with clean HIG spacing and consistent badges.
- [ ] **Step 2: Polish `DailyBriefingCard`**
  - Ensure interactive topic toggle chips (oil, weather, market, tasks, holidays) have distinct active states, clear icons, and responsive layouts.
- [ ] **Step 3: Verify and polish `ExternalNotificationCard`**
  - Ensure channel tabs (LINE, Telegram, Webhook) and connection status badges look crisp and responsive.
- [ ] **Step 4: Run component tests**
  `npm --prefix frontend test src/components/Profile/`
- [ ] **Step 5: Commit changes**
  `git commit -m "refactor(profile): modernize notification cards and styling"`

---

### Task 5: End-to-End Verification & Full Test Suite
**Files:**
- Entire frontend test suite

- [ ] **Step 1: Run complete frontend unit & integration test suite**
  `npm --prefix frontend test`
- [ ] **Step 2: Run complete TypeScript type check**
  `npm --prefix frontend run type-check`
- [ ] **Step 3: Verify git status and clean diff**
  `git status`
