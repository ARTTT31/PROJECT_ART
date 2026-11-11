# UX & Usability Pass Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the fourteen UX/UI defects found in the 2026-11-10 frontend review: cross-account camera-cache leakage, notification state that never leaves one device, missing route/widget states, the global pill rule that forces `!` overrides, mobile ergonomics on the dashboard, and the save-status gap.

**Architecture:** Every fix reuses an existing mechanism instead of inventing one: account scoping comes from `lib/offline/localStore.offlineScope()`, cross-device notification state rides the `profile_version` compare-and-set introduced by the security plan, shared UI primitives move into `components/ui/`, and dashboard sizing becomes a pure, testable helper in `utils/`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4 (`@layer`, `var(--token)` only), Radix Dialog, lucide-react, Vitest + Testing Library, Playwright + axe.

**Spec:** Audit findings below (2026-11-10). Companion plan: [`2026-11-10-security-hardening.md`](./2026-11-10-security-hardening.md) — Task 2 there must ship before Task 2 here.

## Findings this plan closes

| ID | Finding | Evidence | Size |
|---|---|---|---|
| U1 | Camera stream list is cached under an unscoped key and survives logout, so the next account on a shared browser sees the previous account’s cameras | `app/(main)/camera/page.tsx:116,142`; `clearOfflineData()` only purges `artOffline:v1:*` | S |
| U2 | Notification read/dismissed state is localStorage-only: clearing on the phone leaves the desktop badge lit | `components/Layout/NotificationBell.tsx:108,460`; `app/(main)/notifications/page.tsx:32,92` | M |
| U3 | 3 `loading.tsx` for 29 routes; navigating to admin/profile/planner shows an empty frame | `find src/app -name loading.tsx` | S–M |
| U4 | Four widgets render a blank box on API failure, with no message or retry | `OilPriceWidget`, `WeatherWidget`, `DailyDigestWidget`, `CurrencyConverterWidget` | S |
| U5 | No shared Button; unlayered `button { border-radius: 9999px }` beats Tailwind, which is why cards needed `rounded-[14px]!`; 252 raw `<button>` vs 186 `aria-label` | `app/globals.css` (~line 1487); `components/Dashboard/WidgetManagerDialog.tsx` | M |
| U6 | Toasts are fixed top-centre, where the mobile header and notch sit | `components/Toast/ToastProvider.tsx:134` | S |
| U7 | axe runs only against `/login`, `/register`, `/verify-email`; authenticated pages are never audited | `tests/a11y.spec.ts` | M |
| U8 | `w===1` is half-width from `md`, so a 768px tablet squeezes charts into ~360px | `app/(main)/dashboard/page.tsx:106-110` | M |
| U9 | Drag handle is 13px tall, far under the 44px touch target | `app/(main)/dashboard/page.tsx:195-203` | S |
| U10 | Widgets are keyboard-sortable but nothing tells the user how | same file, `KeyboardSensor` at `:417` | S |
| U11 | Autosave has no confirmation that the server received the change | `QuickNotesWidget`, `FinanceWidget` (cache-first writes) | M |
| U12 | Quick notes cannot be undone after delete, unlike finance entries | `components/Widgets/QuickNotesWidget.tsx` | S |
| U13 | All enabled widgets mount at once on page entry | 13 `dynamic()` imports in `dashboard/page.tsx:47-` | M |
| U14 | The bell parses the same weather/oil caches the widgets fetch, duplicating work and risking different numbers | `NotificationBell.tsx:202,269` | M |

## Global Constraints

- Tokens only (`var(--surface)`, `var(--ink)`, `var(--accent)`, `border-[var(--hairline)]`); no hex literals. Radii 18 (cards/dialogs) / 11 (controls) / full (chips, pills).
- Icons from `lucide-react`; brand marks from `@icons-pack/react-simple-icons`. Decorative icons get `aria-hidden="true"`; icon-only controls need `aria-label`.
- Thai copy, Apple HIG states: `active:scale-[0.95]`, hover shifts without lift, hairline borders, no card shadows.
- Commands: `cd frontend && npx vitest run <file>`, `npx tsc --noEmit`, `npx eslint <paths>`, `npm run build`.
- Never run Prettier across the repo; match the surrounding CRLF style by editing targeted lines.
- Do not regress the widget manager work (`WidgetManagerDialog`) or the dashboard layout sync tests.
- Anything visual (U8, U9, U13) is unverified until someone looks at 390px, 768px and 1280px widths.

## Review Focus

1. **Shared browser, second account.** After logout the camera list, notification archive and read marks must not be visible to the next account; the scoped key must change with `offlineScope()`.
2. **Offline still works.** Notification read marks and camera config must keep working with no network — the server copy is additive, never a hard dependency.
3. **No double-save.** The save indicator must reflect the actual POST result (including the `409 profile_conflict` path), not the optimistic cache write.
4. **Reduced motion.** Skeletons, toast entrance and the widget drag animation must respect `prefers-reduced-motion`.
5. **Tailwind layering.** Moving the pill rule into `@layer base` must not let any existing `rounded-full` control silently lose its shape; audit the diff of rendered radii.

---

### Task 1: Scope the camera cache to the account and purge it on logout (U1)

**Files:**
- Modify: `frontend/src/lib/offline/localStore.ts` (export `scopedStorageKey(name)`; extend `clearOfflineData()`), `frontend/src/app/(main)/camera/page.tsx:100-155`
- Test: `frontend/src/lib/offline/localStore.test.ts`, `frontend/src/app/(main)/camera/page.test.tsx` (new)

**Interfaces:**
- Produces: `scopedStorageKey(name: string): string` → `${PREFIX}:${offlineScope()}:${name}`; camera cache key `scopedStorageKey('camera-config')`.
- Consumes: `offlineScope()` (already account-aware).

- [ ] **Step 1: Write the failing test** — seed `localStorage` with an unscoped `artWorkspaceCameraConfig`, render the camera page with `user.camera_config = null`, assert no stream card is rendered; then with the scoped key set for the current user, assert the stream appears. Add a `clearOfflineData()` assertion that both the legacy and scoped keys are gone.
- [ ] **Step 2: Run** — `cd frontend && npx vitest run src/lib/offline/localStore.test.ts src/app/\(main\)/camera/page.test.tsx` → FAIL.
- [ ] **Step 3: Implement** — read/write `localStorage` through `scopedStorageKey('camera-config')` only; in `clearOfflineData()` also remove `artWorkspaceCameraConfig`, `artNotificationHistoryV1:*` and `artNotificationReadV2` (legacy + scoped).
- [ ] **Step 4: Re-run the two files, then `npx tsc --noEmit`** → pass.
- [ ] **Step 5: Commit** — `fix(camera): scope the stream cache to the signed-in account`

---

### Task 2: Keep notification read/dismissed state with the account (U2, needs security Task 2)

**Files:**
- Modify: `backend/app/models/user.py` (`notification_state: Mapped[str | None] = mapped_column(Text)`), `backend/app/schemas/user.py`, `backend/app/api/v1/endpoints/profile.py` (`POST /profile/notification-state` with `base_version`), `backend/alembic/versions/<rev>_add_notification_state.py`
- Modify: `frontend/src/lib/notifications/history.ts` (read/write the server copy, cache-first), `components/Layout/NotificationBell.tsx:108-170,455-470`, `app/(main)/notifications/page.tsx:32,92`
- Test: `backend/tests/test_notification_state.py`, `frontend/src/lib/notifications/history.test.ts`

**Interfaces:**
- Produces: `GET/POST /api/v1/profile/notification-state` with body `{ state: string, base_version?: number }`; payload shape `{ read: string[], dismissed: string[] }` (ids only, capped at 500 each).
- Consumes: `profile_version` CAS helper from security Task 2; `offlineScope()` for the local cache.

- [ ] **Step 1: Backend failing test** — save ids as account A, read them back as A after re-login from a second client; account B must see an empty state; stale `base_version` must answer `409`.
- [ ] **Step 2: Implement backend + migration**, run `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_notification_state.py -v` → pass; `alembic check` on a throwaway SQLite file.
- [ ] **Step 3: Frontend test** — with a mocked API returning `{read:["n1"]}`, the bell’s badge count excludes `n1` on a fresh browser profile and `persistRead` POSTs the merged set exactly once.
- [ ] **Step 4: Implement the cache-first read + background merge** (local wins while offline; server merge on `online` and on mount), keeping the existing localStorage keys as the offline copy.
- [ ] **Step 5: Run the Vitest files, `tsc`, and the bell/notification tests** → pass; commit `feat(notifications): sync read state across devices`

---

### Task 3: Give every data route a loading skeleton (U3)

**Files:**
- Create: `frontend/src/components/ui/PageSkeleton.tsx`
- Create: `frontend/src/app/(main)/admin/loading.tsx`, `profile/loading.tsx`, `planner/loading.tsx`, `notifications/loading.tsx`, `audit/loading.tsx`
- Test: `frontend/src/components/ui/PageSkeleton.test.tsx`

- [ ] **Step 1:** Build `PageSkeleton` with `variant: 'list' | 'cards' | 'form'`, `aria-busy`/`role="status"` and a visually hidden “กำลังโหลด”.
- [ ] **Step 2:** Mirror `camera/loading.tsx` hygiene (no layout shift: reserve header height and card heights).
- [ ] **Step 3:** Add the five `loading.tsx` files; each renders `<PageSkeleton variant="…" />`.
- [ ] **Step 4:** `npx vitest run src/components/ui/PageSkeleton.test.tsx` + `npm run build` → pass; commit `feat(ui): add route skeletons for the remaining pages`

---

### Task 4: One widget state component for empty/error/retry (U4)

**Files:**
- Create: `frontend/src/components/Widgets/WidgetState.tsx`
- Modify: `OilPriceWidget.tsx`, `WeatherWidget.tsx`, `DailyDigestWidget.tsx`, `CurrencyConverterWidget.tsx`
- Test: `frontend/src/components/Widgets/WidgetState.test.tsx` + one new assertion per widget

**Interfaces:**
- Produces: `<WidgetState kind="empty" | "error" | "loading" title description onRetry icon />`; error kind renders a `RotateCcw` ghost button labelled “ลองใหม่”.

- [ ] **Step 1:** Test that `kind="error"` renders the message, an accessible retry button, and calls `onRetry`; `kind="empty"` renders no retry.
- [ ] **Step 2:** Implement with tokens (`bg-[var(--surface-grouped)]`, `text-[var(--ink-muted)]`), 44px minimum height for the retry button.
- [ ] **Step 3:** Replace the blank returns in the four widgets; each keeps its existing skeleton for the loading phase.
- [ ] **Step 4:** Run the widget tests + `npx tsc --noEmit` → pass; commit `fix(widgets): explain empty and failed states instead of rendering nothing`

---

### Task 5: Introduce a shared Button and layer the pill rule (U5)

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`, `frontend/src/components/ui/Button.test.tsx`
- Modify: `frontend/src/app/globals.css` (move `button { … }` into `@layer base` scoped to `.pill`, or drop it and keep explicit radii)
- Modify (call sites, first wave): dashboard header, `WidgetManagerDialog.tsx`, `QuickLinkDialog.tsx`, `RegistrationPolicyCard.tsx`, `components/Auth/*` submit buttons

**Interfaces:**
- Produces: `<Button variant="primary" | "secondary" | "ghost" | "destructive" size="sm" | "md" iconOnly? aria-label>` rendering a `<button>` with `rounded-[11px]` for standard, `rounded-full` only for `pill` variant.

- [ ] **Step 1:** Test variants/sizes, `disabled`, `type="button"` default, and that `iconOnly` without `aria-label` fails the type check (`aria-label: string` required by the union).
- [ ] **Step 2:** Implement; keep `active:scale-[0.95]`, `focus-visible:ring-2`, and a 44px min height on `md`.
- [ ] **Step 3:** Move the global rule into `@layer base` so Tailwind utilities win; delete the now-redundant `!` suffixes only where a test or screenshot confirms the radius is unchanged.
- [ ] **Step 4:** Migrate the first wave of call sites; assert `npm run build` output still contains `border-radius:14px` for the widget cards (the check used previously).
- [ ] **Step 5:** Run `npx vitest run src/components/ui/Button.test.tsx`, `tsc`, `eslint`, `npm run build` → pass; commit `refactor(ui): add a shared Button and stop the global pill override`

---

### Task 6: Move toasts above the fold on mobile (U6)

**Files:**
- Modify: `frontend/src/components/Toast/ToastProvider.tsx:128-170`
- Test: `frontend/src/components/Toast/ToastProvider.test.tsx`

- [ ] **Step 1:** Test: error toasts render in an `aria-live="assertive"` region, a dismiss button exists, and no more than three are stacked (older ones drop).
- [ ] **Step 2:** Container becomes `fixed inset-x-3 bottom-4 sm:inset-x-auto sm:left-1/2 sm:top-6`; keep the existing z-index token and `prefers-reduced-motion` guard.
- [ ] **Step 3:** Run the toast test + the components that mock toasts (`AICopilotDrawer.test.tsx`, `useDashboardLayout.test.ts`) → pass; commit `fix(ui): put toasts where a phone can reach them`

---

### Task 7: Audit authenticated pages with axe (U7)

**Files:**
- Modify: `frontend/tests/a11y.spec.ts` (add an authenticated project/storage state), `frontend/playwright.config.ts`
- Create: `frontend/tests/a11y-authenticated.spec.ts`

- [ ] **Step 1:** Seed a session via the API (`POST /auth/login` with the test account) inside `globalSetup`, write `storageState` to `.auth/user.json` (git-ignored).
- [ ] **Step 2:** Run axe on `/dashboard`, `/admin`, `/profile`, `/planner` at 390px and 1280px; fail on `critical`/`serious` only, as the existing spec does.
- [ ] **Step 3:** Fix what it reports (labels, heading order, contrast) — no blanket exclusions; if a rule cannot be met, document why next to the selector.
- [ ] **Step 4:** `npx playwright test tests/a11y-authenticated.spec.ts` → pass; add the job to `.github/workflows/ci.yml`; commit `test(a11y): cover the signed-in surfaces`

---

### Task 8: Make dashboard sizing a tested helper (U8)

**Files:**
- Create: `frontend/src/utils/widgetGrid.ts`, `frontend/src/utils/widgetGrid.test.ts`
- Modify: `frontend/src/app/(main)/dashboard/page.tsx:106-110` (import the helper)

**Interfaces:**
- Produces: `widgetColSpan(w: 1 | 2 | 3): string` → `w===3: 'col-span-full'`, `w===2: 'col-span-full sm:col-span-12 md:col-span-8 lg:col-span-8'`, `w===1: 'col-span-full sm:col-span-6 md:col-span-6 lg:col-span-4'`.

- [ ] **Step 1:** Test all three mappings (string equality is enough; the breakpoints are the contract).
- [ ] **Step 2:** Extract the helper, update the call site, and confirm the widget manager tests and `useDashboardLayout` tests still pass.
- [ ] **Step 3:** Manual check at 390 / 768 / 1280 px: a `w=1` card is full, half, third-width; charts show no clipped axis labels. Record the checked widths in the commit message.
- [ ] **Step 4:** Commit `fix(dashboard): give small widgets a readable width on tablets`

---

### Task 9: Enlarge the drag target and explain keyboard sorting (U9, U10)

**Files:**
- Modify: `frontend/src/app/(main)/dashboard/page.tsx:190-215`

- [ ] **Step 1:** Wrap the grip in a `h-11 w-16` (44px) transparent hit area positioned in the card’s top band; the visible pill stays 13px so nothing moves visually.
- [ ] **Step 2:** Add `aria-roledescription="วิดเจ็ตที่ย้ายได้"` and an `aria-describedby` hint (“กด Space แล้วใช้ลูกศรเพื่อย้าย”) rendered once per grid in a visually hidden paragraph.
- [ ] **Step 3:** Keyboard test in Testing Library: focus the handle, `Space`, `ArrowRight` → order changes (or assert the sensor wiring via the existing drag tests).
- [ ] **Step 4:** Commit `fix(dashboard): make the drag handle touch-sized and teach keyboard sorting`

---

### Task 10: Show when a widget actually saved, and undo a note deletion (U11, U12)

**Files:**
- Modify: `frontend/src/components/Widgets/QuickNotesWidget.tsx`, `frontend/src/components/Widgets/FinanceWidget.tsx`
- Create: `frontend/src/components/Widgets/SaveStatus.tsx`
- Test: `frontend/src/components/Widgets/SaveStatus.test.tsx`, updated widget tests

**Interfaces:**
- Produces: `<SaveStatus state="idle" | "saving" | "saved" | "offline" | "conflict" savedAt? />` — renders “บันทึกแล้ว 14:32” from `Intl.DateTimeFormat('th-TH', {hour:'2-digit', minute:'2-digit'})`.

- [ ] **Step 1:** Test `saved` renders the time, `conflict` renders “มีข้อมูลใหม่จากอุปกรณ์อื่น”, `offline` renders “จะซิงก์เมื่อออนไลน์”.
- [ ] **Step 2:** Wire the state to the real POST result in both widgets (not to the cache write); on the `409` path reuse the message from the security plan’s `saveProfileBlob`.
- [ ] **Step 3:** Notes delete: remove locally, show `showSuccess('ลบแล้ว', …)` with a 5-second undo action that restores before the POST commits.
- [ ] **Step 4:** Run the two widget suites + `SaveStatus` test → pass; commit `feat(widgets): show save status and allow undoing a deleted note`

---

### Task 11: Mount widgets near the viewport only (U13)

**Files:**
- Create: `frontend/src/hooks/useInViewport.ts`, `frontend/src/hooks/useInViewport.test.ts`
- Modify: `frontend/src/app/(main)/dashboard/page.tsx` (wrap each sortable item)

- [ ] **Step 1:** Test the hook with a mocked `IntersectionObserver` (fires once, disconnects, respects `rootMargin`).
- [ ] **Step 2:** Render a 120px-tall placeholder matching `widgetColSpan` until visible, then mount the widget; keep the drag handle outside the placeholder so sorting still works.
- [ ] **Step 3:** Add `content-visibility: auto` with `contain-intrinsic-size` to the placeholder.
- [ ] **Step 4:** Verify the widget manager count and the layout tests are unaffected; commit `perf(dashboard): mount widgets as they approach the viewport`

---

### Task 12: One market snapshot for the bell and the widgets (U14)

**Files:**
- Create: `frontend/src/hooks/useMarketSnapshot.ts`
- Modify: `frontend/src/components/Layout/NotificationBell.tsx:195-280`, `frontend/src/components/Widgets/OilPriceWidget.tsx`, `frontend/src/components/Widgets/WeatherWidget.tsx`
- Test: `frontend/src/hooks/useMarketSnapshot.test.ts`

- [ ] **Step 1:** Test: two consumers in the same render tree trigger one fetch; cached values are returned while revalidating; a failure keeps the last known value without throwing.
- [ ] **Step 2:** Implement with a module-level promise + `useSyncExternalStore`-style subscription, keyed by resource (`weather`, `oil`).
- [ ] **Step 3:** Replace the bell’s manual cache parsing and both widgets’ fetches; keep the localStorage cache keys intact for offline.
- [ ] **Step 4:** Run the hook test, the bell test and both widget suites → pass; commit `refactor(data): share one market/weather snapshot between bell and widgets`

---

### Task 13: Verification

- [ ] `cd frontend && npx tsc --noEmit && npx eslint "src/**/*.{ts,tsx}" && npm test && npm run build` (before the build, confirm `public/sw.js` is regenerated).
- [ ] `npx playwright test tests/a11y.spec.ts tests/a11y-authenticated.spec.ts tests/smoke.spec.ts`.
- [ ] Manual pass at 390 / 768 / 1280 px: dashboard (small/medium/large widgets), widget manager, camera page after a logout/login as a second account, notification badge after clearing on another device.
- [ ] `prefers-reduced-motion` pass: no skeleton shimmer, no toast slide, no widget entrance animation.
- [ ] Update `docs/product/roadmap-features.md` status for this phase and commit `docs(ux): record the usability pass`.
