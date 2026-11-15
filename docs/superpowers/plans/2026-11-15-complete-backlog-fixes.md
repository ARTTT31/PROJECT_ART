# Complete Backlog Implementation Plan (U4, U5, U11, P2-Client, U3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all remaining open backlog items identified in the system audit: Widget empty/error states (U4), Apple HIG Button primitive (U5), Autosave visual feedback (U11), Client-side profile version optimistic concurrency (P2), and Route loading skeleton for share-target (U3).

**Architecture:**
- Create `frontend/src/components/Widgets/WidgetState.tsx` with Apple HIG styling and tokens for error/retry/empty/loading fallback, wired into the 4 data widgets.
- Create `frontend/src/components/ui/Button.tsx` with standard Apple HIG variants, 11px control radius, springy tap, and strict aria-label enforcement on icon-only buttons.
- Enhance `QuickNotesWidget` and `FinanceWidget` with autosave status indicators and `base_version` optimistic locking (reading from `user.profile_version` and updating upon response or detecting 409 conflict).
- Add `share-target/loading.tsx` to complete the loading skeleton coverage across all `(main)` routes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React, Vitest, Testing Library.

## Global Constraints
- Strict Apple HIG: `rounded-apple-lg` (18px) for containers/cards, `rounded-apple-md` (11px) for buttons/controls, `rounded-full` for chips/pills.
- No hardcoded hex color codes: strictly consume CSS custom properties from `globals.css` (e.g. `var(--surface)`, `var(--ink)`, `var(--accent)`, `var(--hairline)`).
- Icons from `lucide-react` with `aria-hidden="true"` when decorative; icon-only buttons require `aria-label`.
- All Vitest and backend Pytest test suites must stay 100% green with 0 type errors (`tsc --noEmit`) and 0 lint warnings (`eslint .`).

## Review Focus
1. Empty/error widgets must not cause layout collapse or crash when upstream data is throttled or offline.
2. The Button primitive must support all standard HTML button props, forward ref properly in React 19 (ref as prop), and require `aria-label` when `iconOnly` is true.
3. Autosave indicator must accurately reflect debounce -> saving -> saved cycle without flickering.
4. Sending `base_version` must be backward-compatible with older backend/cached states (sending undefined when version is unknown).

---

### Task 1: WidgetState Component for Error, Empty, and Retry (U4)

**Files:**
- Create: `frontend/src/components/Widgets/WidgetState.tsx`
- Create: `frontend/src/components/Widgets/WidgetState.test.tsx`
- Modify: `frontend/src/components/Widgets/OilPriceWidget.tsx`
- Modify: `frontend/src/components/Widgets/WeatherWidget.tsx`
- Modify: `frontend/src/components/Widgets/DailyDigestWidget.tsx`
- Modify: `frontend/src/components/Widgets/CurrencyConverterWidget.tsx`

**Interfaces:**
- Props: `kind: 'error' | 'empty' | 'loading'`, `title: string`, `description?: string`, `onRetry?: () => void`, `icon?: LucideIcon`, `className?: string`.
- Renders: Apple HIG styled card with appropriate soft badge icon (`AlertTriangle`, `Inbox`, or custom), informative copy, and a retry button if `onRetry` is provided.

- [ ] **Step 1: Write unit tests in `WidgetState.test.tsx`**
- [ ] **Step 2: Implement `WidgetState.tsx`**
- [ ] **Step 3: Wire into `OilPriceWidget.tsx`, `WeatherWidget.tsx`, `DailyDigestWidget.tsx`, `CurrencyConverterWidget.tsx`**
- [ ] **Step 4: Run Vitest on modified widgets and `WidgetState.test.tsx`**
- [ ] **Step 5: Commit `feat(widgets): add WidgetState for empty and error fallback`**

---

### Task 2: Apple HIG Button Component (U5)

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Button.test.tsx`
- Modify: `frontend/src/components/ui/index.ts` (export Button)

**Interfaces:**
- Variants: `primary`, `secondary`, `ghost`, `destructive`, `outline`.
- Sizes: `sm` (h-8 px-3 text-xs), `md` (h-10 px-4 text-sm), `lg` (h-12 px-5 text-base), `icon` (aspect-square p-2).
- Behavior: Apple HIG `active:scale-[0.95]`, `rounded-apple-md` (11px) by default (or `rounded-full` for pill variant), focus ring.
- Types: Discriminated union requiring `aria-label` if `iconOnly` is set.

- [ ] **Step 1: Write comprehensive tests in `Button.test.tsx`**
- [ ] **Step 2: Implement `Button.tsx`**
- [ ] **Step 3: Run Vitest `Button.test.tsx` and type-check**
- [ ] **Step 4: Commit `feat(ui): add Apple HIG Button primitive`**

---

### Task 3: Autosave Visual Feedback (U11) & Base Version Concurrency (P2)

**Files:**
- Modify: `frontend/src/types/index.ts` (add `profile_version?: number` to `AuthUser`)
- Modify: `frontend/src/lib/api/schemas.ts` (add `profile_version` to `AuthUserSchema`)
- Modify: `frontend/src/components/Widgets/QuickNotesWidget.tsx`
- Modify: `frontend/src/components/Widgets/FinanceWidget.tsx`
- Test: Update `QuickNotesWidget.test.tsx` and `FinanceWidget.test.tsx`

**Interfaces:**
- Autosave status indicator: `'idle' | 'saving' | 'saved' | 'error' | 'conflict'`
  - Idle: subtle or hidden
  - Saving: tiny animated spinner or subtle text "กำลังบันทึก..."
  - Saved: checkmark icon "บันทึกแล้ว" fading out after 2s
  - Conflict / Error: red warning indicator "มีข้อมูลใหม่จากอุปกรณ์อื่น" or "บันทึกไม่สำเร็จ"
- API payload: include `base_version: user?.profile_version` in `PUT/POST /profile/quick-notes` and `finance`.
- On 200 response: parse `X-Profile-Version` header or response body and call `updateUser({ profile_version: newVer })`.

- [ ] **Step 1: Write tests for autosave indicator and base_version in QuickNotesWidget and FinanceWidget tests**
- [ ] **Step 2: Implement save status and version headers in QuickNotesWidget and FinanceWidget**
- [ ] **Step 3: Run Vitest suite for QuickNotes and Finance**
- [ ] **Step 4: Commit `feat(widgets): add autosave visual feedback and optimistic concurrency versioning`**

---

### Task 4: Route Loading Skeleton for Share Target (U3)

**Files:**
- Create: `frontend/src/app/(main)/share-target/loading.tsx`

- [ ] **Step 1: Implement `loading.tsx` using `PageSkeleton`**
- [ ] **Step 2: Run build to ensure static routing and skeletons pass**
- [ ] **Step 3: Commit `feat(pwa): add loading skeleton for share-target`**

---

### Task 5: Full Verification and Documentation Update

**Files:**
- Modify: `docs/internal/status.md`
- Modify: `docs/internal/changelog.md`

- [ ] **Step 1: Run full frontend test suite (`npx vitest run`), type-check, and lint**
- [ ] **Step 2: Run full backend test suite (`pytest -q`), flake8, and mypy**
- [ ] **Step 3: Update `status.md` and `changelog.md` with verified numbers and closed findings**
- [ ] **Step 4: Commit `docs: record resolution of U3, U4, U5, U11, and P2-client in status and changelog`**
