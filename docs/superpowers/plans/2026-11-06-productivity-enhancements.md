# Productivity & System Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the top productivity widgets and system improvements planned for ART Workspace, starting with Dependabot optimization (preventing branch explosion) followed by the Focus Timer (Pomodoro) widget and Workspace Backup & Restore.

**Architecture / Design Source of Truth:**
- Apple HIG: `rounded-[18px]` cards, `rounded-[11px]` controls, hairline borders (`border-[var(--hairline)]`), spring active states (`active:scale-[0.95]`).
- Design Tokens: `bg-[var(--surface)]`, `text-[var(--ink)]`, `text-[var(--ink-secondary)]`, `bg-[var(--accent)]`. No hardcoded hex values.

---

### Task 1: Dependabot Optimization (`.github/dependabot.yml`)

- [ ] **Step 1.1**: Update `.github/dependabot.yml` to group updates for `pip`, `npm`, and `github-actions`, set schedule interval to `monthly`, and reduce open PR limit to 2 per ecosystem.
- [ ] **Step 1.2**: Verify YAML formatting and commit changes.

---

### Task 2: Focus Timer (Pomodoro Widget) for Dashboard

- [ ] **Step 2.1**: Create `frontend/src/components/Widgets/FocusTimerWidget.tsx`
  - Modes: โฟกัส (25 นาที), พักสั้น (5 นาที), พักยาว (15 นาที).
  - Apple HIG circular progress ring with stroke animation, time display (`MM:SS`), start/pause/reset buttons with spring feel.
  - Web Audio API soft chime upon completion (no external audio files needed).
  - Support S, M, L sizes conforming to `WidgetSizeToggle`.
- [ ] **Step 2.2**: Register widget in `frontend/src/hooks/useDashboardLayout.ts` and `frontend/src/app/(main)/dashboard/page.tsx`.
- [ ] **Step 2.3**: Write unit test `frontend/src/components/Widgets/FocusTimerWidget.test.tsx` verifying timer display, mode switching, play/pause state transitions, and S/M/L rendering.
- [ ] **Step 2.4**: Run `npm run test -- FocusTimerWidget`, `npm run type-check`, and `npm run lint`.
- [ ] **Step 2.5**: Commit Task 2 changes.

---

### Task 3: Workspace Data Backup & Restore (Profile)

- [ ] **Step 3.1**: Create `frontend/src/components/Profile/WorkspaceBackupCard.tsx`
  - Export: packages current user's quick notes, finance entries, watchlist, and layout settings into a downloadable JSON file.
  - Import: file upload with JSON validation, schema verification, and confirmation dialog before restoring.
- [ ] **Step 3.2**: Add `WorkspaceBackupCard` into `frontend/src/app/(main)/profile/page.tsx` under the workspace tab.
- [ ] **Step 3.3**: Write unit tests for export/import parsing and error handling.
- [ ] **Step 3.4**: Verify type-check, lint, and tests.
- [ ] **Step 3.5**: Commit Task 3 changes.

---

### Task 4: Mini Calendar & Planner Widget

- [ ] **Step 4.1**: Create `frontend/src/components/Widgets/CalendarWidget.tsx` integrating Thai holidays from `/api/v1/planner/holidays` with personal reminders.
- [ ] **Step 4.2**: Register `calendar` widget in `useDashboardLayout.ts` and dashboard page.
- [ ] **Step 4.3**: Unit test and verify.
- [ ] **Step 4.4**: Commit Task 4 changes.
