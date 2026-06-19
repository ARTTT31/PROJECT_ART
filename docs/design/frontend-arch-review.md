## ART Workspace (Frontend) — UX/UI Review + Code Quality / Architecture

Scope reviewed: `frontend/src/app/*`, `frontend/src/components/*`, `frontend/src/styles/*`, `frontend/src/lib/*`

---

# 1) Executive Summary

**Overview:** The UI clearly follows the “Liquid Glass” direction (with deliberate tokens + patterns) and has several good foundational a11y elements (focus-visible, reduced-motion in many areas, touch target ≥44px, etc.). However, there is "inconsistency" across pages and some risks regarding architecture/security/long-term maintainability.

**Top Issues with Highest Impact (Sorted by Value):**
1. **Auth/Session logic is scattered** (DashboardLayout + each page + apiClient interceptor) → Causes duplication/inconsistent behavior/difficult to debug.
2. **Modal/Dropdown lacking product-grade a11y** (No focus trap, role=dialog/aria-modal, ESC close, restore focus).
3. **Dashboard "Widget layout/management" flow is incomplete** (Has a modal but no entrypoint to open it, DnD lacks keyboard/touch support).
4. **API layer is not unified + endpoint bug in authService** (`baseURL=/api/v1` but calling `/api/v1/auth/*` redundantly) and mixes both `fetch` + `axios`.
5. **XSS risk from `dangerouslySetInnerHTML`** in TaskListWidget (Fetching description and converting to HTML). Should sanitize or change rendering method.

---

# 2) UX/UI Review (Improvement Suggestions)

## 2.1 Navigation / App Shell
- **Sidebar section titles use uppercase + high tracking** (e.g., `text-[11px] uppercase tracking-wider`), making the "UI voice" feel rigid and too template-like.  
  → Recommendation: Use **sentence case** + reduce tracking and emphasize hierarchy through spacing/weight instead.
- Header user menu uses an overlay like `button className="fixed inset-0"` to close the menu: Good for easy closing, but still lacks:
  - Close with **Esc**
  - **Focus trap within the menu** and restoring focus back to the original button when closed.

## 2.2 Dashboard: Widgets (Layout/Visibility/Sorting)
What's already there: Uses `localStorage` to save layout + visibility, has DnD, has WidgetSizeToggle.

Gaps/Suggestions:
- Has a `showConfigModal` state and a "Widget Display" UI modal but **no button/entrypoint** to open the modal.
  → Add a "Toolbar" on the Dashboard (e.g., top right corner of the page) containing:
  - **Manage Widgets** button (Opens show/hide modal).
  - **Layout** button (Enters edit mode: shows drag handle, shows drop indicator, has reset layout button).
- Current DnD uses HTML drag events:
  - Lacks proper **touch** support.
  - Lacks **keyboard reorder** support.
  → Recommendation: Migrate to `@dnd-kit` and implement "Reorder actions" (Up/Down) for keyboards.

## 2.3 Modals / Dialogs
Examples: Dashboard widget modal, CreateUserDialog

Currently missing product UI standards:
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Initial focus moves into the dialog and **locks focus preventing it from escaping behind**.
- Close with Esc / clicking outside (and control whether it should be closable).
- Upon closing, **restore focus** to the previous element.

Recommendation: Create a central `Dialog` component (like Radix UI Dialog or Headless UI) and use it everywhere.

## 2.4 Motion & Visual Density
- The "Liquid Glass" approach is beautiful, but some parts are "motion-heavy", especially the Weather widget + multi-layer background animations.
  - `weather.css` contains continuous sets of animations and does not fully cover `prefers-reduced-motion`.
  → Recommendation:
  - Add `@media (prefers-reduced-motion: reduce)` in `weather.css` to disable all critical animations.
  - Create a "Calm Mode" letting users disable background animations for widgets.

## 2.5 Accessibility (AAA target) — Gaps to Close
- Placeholders in multiple areas use a light tone (`#94a3b8`) on a white background, potentially failing AAA.  
  → Darken the placeholder (e.g., `#64748b`) or add a bg tint to pass the contrast ratio.
- "Task Details" in TaskListWidget uses `dangerouslySetInnerHTML` and injects `<a target="_blank">`.  
  → Besides security, this impacts a11y (e.g., link text/keyboard focus state needs to be consistent).

---

# 3) Code Quality / Architecture Review (Refactoring Suggestions)

## 3.1 Auth Boundary (Most Important)
Currently, token/user checks are duplicated in:
- `useAuth.ts`
- `DashboardLayout.tsx`
- `dashboard/page.tsx`, `profile/page.tsx`, `admin/page.tsx`, etc.
- `apiClient` interceptor 401 redirects via `window.location.href = '/login'`

Drawbacks:
- Inconsistent behavior (some use `router.push`, others `window.location.href`).
- The page renders as `null` while waiting for the user → Resulting in a "white screen".

Recommended Structure:
1. Create an `AuthProvider` (Context) + `useAuth()` uniformly across the system.
2. Create an `AuthGuard` component for pages requiring login:
   - Show skeleton/loading state.
   - Redirect using `router.replace('/login')`.
3. Handle 401s in one place (fetch/axios wrapper) and dispatch an event for the AuthProvider to logout.

> Note: Long-term, storing "tokens in localStorage" presents XSS risks; if possible, migrate to **HttpOnly cookies** (requires backend changes).

## 3.2 Unify API Layer + Fix Endpoint Bug
Found a likely bug in `src/lib/api/auth.ts`:
- `client.ts` sets `baseURL = ${API_URL}/api/v1`
- However, `auth.ts` calls `apiClient.post('/api/v1/auth/login', ...)`, resulting in `/api/v1/api/v1/auth/login`.

Recommendations:
- Establish a single convention: call `apiClient.post('/auth/login', ...)` (Remove `/api/v1`).
- Decide clearly whether to use `axios` or `fetch`:
  - If `axios`: Stop using `fetch` directly in pages and utilize the service layer.
  - If `fetch`: Create `fetcher.ts` that attaches the token + handles 401s + timeouts consistently.
- Use `next.config.js` to actually rewrite `/api/*`: The UI calls `/api/v1/...` (no hardcoded hosts).

## 3.3 Security: Prevent Direct HTML Injection into Pages
`TaskListWidget.tsx` contains `dangerouslySetInnerHTML` with a description.

Suggested Alternatives (Choose 1):
1. **Best Approach:** The backend sends plain text/structured fields, and you render it yourself.
2. Use a sanitize library (DOMPurify) before rendering.
3. Display as plain text by escaping HTML and do whitelist-based link parsing.

## 3.4 CSS Architecture / Design System
Found 3 mixed styling approaches:
- Tailwind utilities.
- Global tokens + global element styles (`globals.css` heavily styling inputs/buttons).
- Page CSS (`login.css`, `weather.css`), plus a `login.module.css` that seems "duplicate/unused".

Recommendations:
- Decide on the "Global level":
  - Keep them as **tokens + utilities** rather than overriding elements globally.
- Reduce duplicates: If `login.module.css` is unused, delete it (reduces confusion).
- Build component primitives:
  - `Button`, `Input`, `Card`, `Badge`, `Dialog`.
  - So pages don't have to reinvent styles every time.

## 3.5 Data Fetching Strategy
There is a React Query provider, but `useQuery/useMutation` is not yet utilized.

Options:
- If using React Query: Move critical data-fetching (users, audit logs, sessions, calendar events) to queries/mutations for caching + retries + consistent loading/error states.
- If not using it: Remove the provider for simplicity.

---

# 4) Refactoring Plan (Prioritized Recommendations)

## Quick Wins (0.5–2 Days)
1. Add a "Manage Widgets" entrypoint to open `showConfigModal`.
2. Fix the authService endpoint bug, or delete/relocate if unused.
3. Change `window.location.href` → `router.replace` and unify redirect behaviors.
4. Add `prefers-reduced-motion` to `weather.css` (disable main animations).
5. Apply basic modal a11y: `role="dialog"`/`aria-modal`/`aria-labelledby` + Esc close.

## Medium (3–10 Days)
1. Implement `AuthProvider + AuthGuard` and remove auth checks from all pages.
2. Build a central `Dialog` component and migrate all modals.
3. Establish a single API wrapper/service layer (either axios or fetch).
4. Migrate DnD to `@dnd-kit` + keyboard reorder.

## Long (2–4 Weeks)
1. Move token from localStorage → HttpOnly cookie (update backend).
2. Refine the design system to be "clear and lightweight": tokens + primitives + reduce global overrides.
3. Adjust Calendar widget from iframe → internal rendering (if custom UX control is desired).

---

# 5) "Actionable" Proposals (Choose 1 set to begin)
A) Implement **AuthProvider/AuthGuard** (Quickest way to reduce bugs + duplicate code).  
B) Implement **Dialog system** (Fixes a11y + UX consistency for modals system-wide).  
C) Implement **Dashboard edit mode + widget manager** (Directly adds UX value).  

Let me know if you want to start with A/B/C — I will implement the code in sets and test it for you.
