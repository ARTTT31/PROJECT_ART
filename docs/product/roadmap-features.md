# Roadmap & Feature Inventory

**Last updated:** November 21, 2026

> **Sources of truth.** This file inventories what exists and what is planned. It must not
> restate or contradict the documents that own those decisions:
>
> - Product brief, users, brand personality: [`PRODUCT.md`](../../PRODUCT.md)
> - Design language, colour, typography, motion: [`DESIGN.md`](../../DESIGN.md) and
>   [`design-system/workspace/MASTER.md`](../../design-system/workspace/MASTER.md)
> - How the system is built today: [`docs/internal/architecture.md`](../internal/architecture.md)
> - Verified test state, open findings, accepted constraints:
>   [`docs/internal/status.md`](../internal/status.md)
> - When a behaviour changed and why: [`docs/internal/changelog.md`](../internal/changelog.md)
>
> An earlier revision of this file declared gradients and glassmorphism part of the brand and
> targeted WCAG AAA. Both contradicted the Apple-HIG design system ("no decorative gradients;
> elevation comes from surface colour and hairline borders") and the AA target in `PRODUCT.md`.
> Those claims were removed rather than left competing with the authority above.

---

## Shipped

### Pages

| Route | Purpose |
|---|---|
| `/login` | Email/password sign-in |
| `/register`, `/verify-email` | Registration policy and email verification |
| `/forgot-password`, `/reset-password` | Self-service password recovery — single-use emailed link, 30-minute TTL, clears lockout and revokes every session on success |
| `/dashboard` | Widget grid — rearrange, resize (S/M/L), show/hide |
| `/profile` | Name/email/password, 2FA, own devices, Quick Links, main-menu config, camera config, per-account branding, AI provider, data export |
| `/notifications` | Full alert archive with read/dismissed state |
| `/admin` | Admin console — registration policy, pending approvals, user management |
| `/audit` | Searchable/filterable activity log (admin only) |
| `/camera` | CCTV monitor — permission-gated per user |
| `/share-target` | PWA share target — inbox for links and text shared from other apps |

### Dashboard widgets

| Widget | Sizes | Data source |
|---|---|---|
| โน้ตด่วน / To-do วันนี้ (notes) | S/M/L | Per-account JSON via `/profile/quick-notes` |
| คิดราคา / กำไร (calc) | S/M/L | Client-side |
| ค่าเงิน · ทอง · SET (market) | S/M/L | Frankfurter, Thai Gold API, Yahoo Finance, via the backend proxy; candle chart drawn in-app |
| รายรับ – รายจ่ายวันนี้ (finance) | S/M/L | Per-account JSON via `/profile/finance`; summary dialog with monthly/all-time totals, categories, 6-month trend, CSV export, undo and a monthly budget |
| รายการติดตาม (watchlist) | S/M/L | Yahoo Finance quotes via `/market/quotes` |
| แปลงสกุลเงิน (converter) | S/M/L | Frankfurter rates via `/market/summary` |
| วันหยุดนักขัตฤกษ์ (holidays) | S/M/L | Confirmed Thai calendars bundled in the repo (2026, 2027) |
| สภาพอากาศ & PM 2.5 (weather) | S/M/L | Open-Meteo + MET Norway (weather), Open-Meteo (AQI), BigDataCloud + OSM Nominatim (geocode), via backend proxy |
| ราคาน้ำมัน (oil price) | S/M/L | Bangchak Open Web API, via the backend proxy |
| QR Code | S/M/L | Client-side |
| โฟกัส / Pomodoro (focus) | S/M/L | Client-side; 25/5/15-minute sessions, counters and a closing chime |
| ปฏิทิน & แพลนเนอร์ (calendar) | S/M/L | Thai holidays bundled in the repo + per-account `/planner` reminders |
| ผลพรีเมียร์ลีก (epl) | S/M/L | Premier League scores and standings via `/football/premier-league` + `/football/standings`, with a 10-minute localStorage cache and a manual refresh |

### Platform

- **Auth:** PyJWT access/refresh in HTTP-only cookies, CSRF double-submit token, account lockout
  (5 attempts -> 30 min), session tracking (IP / user agent / device), and optional TOTP
  two-factor authentication (authenticator app, 10 single-use recovery codes, password + code to
  disable). The code is requested in a dialog after the API answers `totp_required`, with a separate
  recovery-code mode for phone keyboards, and an opt-in "trust this device for 30 days" cookie that
  Profile → Security lists and can revoke per browser (and that logout withdraws). The readable
  `user` cookie is HMAC-signed with `SECRET_KEY`; a value the server did not write is rejected
  instead of being trusted as display data.
- **Authorisation:** `role` plus per-user `accessible_pages`; the sidebar and profile page hide
  what a user cannot reach, and the backend enforces page access for page-scoped APIs.
- **Admin:** a dedicated `/admin` console for user management, page-permission editing,
  registration policy and pending approvals; the user table shows who is online and when they
  were last seen, and a live-sessions panel lists every signed-in device with search, role filter
  and per-device forced logout. `/audit` adds a searchable, paginated activity log.
- **Account recovery:** self-service "forgot password" emails a single-use, 30-minute link; a
  successful reset clears lockout and revokes every session. Login from an unrecognised user
  agent sends a security notice email.
- **Personalisation:** per-account workspace name/tagline/logo, sidebar menu order stored on the
  account (not localStorage), dashboard layout, quick notes, finance entries and watchlist.
  Profile → Security lists the account's own signed-in devices and can sign the others out;
  a dismissible 3-step getting-started card appears on the dashboard for new accounts, and the
  header exposes the ⌘K command palette as a visible button.
- **Appearance:** Profile → รูปลักษณ์ & เมนู picks light/dark and one of 12 accent presets through
  `data-theme` / `data-accent` on `<html>`, alongside the date-format and language card. Every
  surface, ink, accent and status colour is a semantic token (`--surface`, `--ink`, `--danger-*`, …)
  rather than a Tailwind palette utility, so one token layer drives both themes. The palette, radii
  and motion themselves stay owned by `DESIGN.md`.
- **Market data:** authenticated proxy for exchange rates, Thai gold, COMEX gold, the SET index,
  watchlist quotes and OHLC candles; every provider degrades independently.
- **Notifications:** notification bell with derived alerts (holidays, weather, oil prices) plus
  a live WebSocket feed. The socket authenticates during the handshake and the connection
  registry is capped per user; broadcasts are admin-only and fan out through Redis pub/sub
  when `WS_BROADCAST_REDIS_URL` is set.
- **Resilience:** the weather/geocode proxies retry throttled upstreams and automatically fail over
  to secondary providers (MET Norway for weather forecast, OpenStreetMap Nominatim for GPS address lookup);
  fall back to stale data and persist the last known good payload in `weather_cache`; oil prices use the
  same table before dropping to maintained constants. Each namespace keeps its newest row past the
  30-day retention window, so the fallback survives a cold start.
- **Security:** per-path CSP (`default-src 'none'` everywhere except `/docs`, `/redoc` and
  `/openapi.json`), HSTS, `nosniff`/`DENY` headers, rate limiting keyed on a client address
  that only a trusted proxy may assert, API docs off unless opted in, startup refusal on a
  weak `SECRET_KEY`.
- **Operations:** Sentry (opt-in via `SENTRY_DSN`), `/health` (liveness + database status) and
  `/health/ready` (503 when the database is down) plus an admin-only system health report,
  `X-Request-ID` on every response and on every log line, scheduled session cleanup, Alembic
  migrations as the only schema authority (`alembic check` runs in CI), GitHub Actions CI,
  Dependabot updates.

---

## Constraints (accepted, documented)

| Constraint | Detail |
|---|---|
| Single instance by default | The WebSocket registry can fan out through Redis (`WS_BROADCAST_REDIS_URL`) and the rate limiter can use Redis (`SLOWAPI_STORAGE_URI`), but both default to process-local and startup logs a `[SCALING]` notice. See README -> *Horizontal scaling*. |
| Third-party market data | Yahoo Finance / Frankfurter / Thai Gold API have no SLA; the widget shows the last known value (or an empty block) rather than failing the whole page. |
| Partial i18n | A `th`/`en` message catalogue (`lib/i18n`) exists and drives 34 of the 82 components; the rest still hardcode Thai copy. Adding a language means migrating a screen at a time, not flipping a switch. |
| Partial frontend coverage | 498 Vitest tests across 74 files; 759 backend tests at 84.71% coverage (Python 3.14, verified 2026-11-27). Route-level tests exist for `login`, `register`, `forgot-password`, `share-target`, `admin` and `audit`, so `npm run test:coverage` remains the honest number. Playwright runs axe checks on the auth pages and a live register → login E2E against the backend in CI. |
| CSP `script-src` | The frontend CSP keeps `'unsafe-inline'` for scripts because Next emits its RSC payload as inline scripts and the theme bootstrap is inline; a nonce needs middleware plus a deploy-verified pass over Google GSI and the service worker. Image sources are already an explicit allow-list (`NEXT_PUBLIC_CAMERA_IMG_ORIGINS`). |

---

## Next Roadmap (Active & Planned)

### Phase 1: Productivity, Usability & Maintenance (Shipped)

All five items below shipped in `d58ae9f`, `2d9aabf` and `73a9571`; they stay listed so the
scope is not re-litigated as "still planned".

1. **Dependabot Optimization (Maintenance) — Shipped**
   - Group updates and switch schedule to monthly with lower open PR limit to prevent remote branch clutter while keeping dependencies updated.
2. **Focus Timer / Pomodoro Widget (Dashboard) — Shipped**
   - Apple HIG styled circular progress timer (25m Focus / 5m Short Break / 15m Long Break).
   - Springy controls (`active:scale-[0.95]`), session counters, gentle audio notification chime, full S/M/L responsive sizing.
3. **Workspace Data Backup & Restore (Profile / Data Portability) — Shipped**
   - One-click full workspace JSON export & import in Profile (Quick Notes, Finance entries, Watchlist symbols, Quick links, Dashboard layout).
   - JSON validation and preview before applying.
4. **Mini Calendar & Planner Widget (Dashboard) — Shipped**
   - Interactive monthly grid view combining Thai official holidays with personal errands and reminders.
5. **Command Palette Quick Actions (`Ctrl+K` / `⌘K`) — Shipped**
   - Quick jump to Quick Links, page navigation, and quick entry actions directly from keyboard search.

### Phase 2: Security & Platform Hardening

1. **Two-Factor Authentication (2FA / TOTP) — Shipped (2026-11-06)**
   - `pyotp`-free RFC 6238 implementation in `app/core/totp.py`, verified against the RFC vectors.
   - `/auth/2fa/setup|enable|disable|status`, QR + manual secret, 10 single-use recovery codes,
     and a `totp_required` login step that never mints a session before the code checks out.
   - Admin escape hatch: `POST /users/{id}/reset-2fa` (admin only, audit `ADMIN_RESET_2FA`) clears
     the secret and recovery codes for someone who lost both the device and the codes. It refuses
     the caller's own account — a stolen admin session must not be able to strip its own second
     factor, which is why the self-service path still demands password + live code.
2. **Admin 2FA Enforcement — Shipped (2026-11-18)**
   - `REQUIRE_ADMIN_2FA` (default on): the admin API answers `403` until the account has a second
     factor, while the session keeps working so Profile → Security can enable it. The admin console
     shows the backend's own message with a link to that screen.
3. **Step-up Re-verification for Dangerous Actions — Shipped (2026-11-18)**
   - `POST /auth/step-up` verifies a live code (or a recovery code) and sets a signed `step_up`
     cookie bound to the access token's `sid`, valid for `STEP_UP_TTL_SECONDS` (default 300).
   - Gated: change password, data export, sign out every other device, forget every trusted browser.
     Accounts without 2FA pass through — there is no second factor to re-ask for.
   - `DELETE /profile/sessions` and `DELETE /auth/2fa/trusted-devices` exist so the UI asks for the
     code once instead of once per row.
   - Turning 2FA *off* was not added to the list: `POST /auth/2fa/disable` already requires the
     password plus a live code on every call, which is stronger than a five-minute cookie.
4. **Redis for Rate Limiting & Multi-Instance Scaling — Shipped**
   - `SLOWAPI_STORAGE_URI` is read by `app/core/rate_limit.py` with an in-memory fallback;
     login backoff shares the same backend. Remaining work is operational: point the env var at
     Redis on the deployment and confirm the buckets are shared across instances.
5. **Signed / Opaque User Cookie — Shipped (2026-11-06)**
   - HMAC-SHA256 over the percent-encoded payload, appended after the last dot. Unsigned legacy
     values are rejected rather than accepted without a signature.
6. **Offline-first PWA Enhancements — Shipped (2026-11-06, client outbox)**
   - Quick notes, finance entries, watchlist symbols and personal reminders write to localStorage
     first and keep a per-resource pending snapshot (`lib/offline/localStore.ts`). The widget
     replays it on the `online` event and again on mount, so an edit made offline survives a
     reload and lands as soon as the app can talk to the API. `OfflineBanner` shows the queued
     count and confirms the flush.
   - `BackgroundSync` in the service worker is deliberately **not** used: the API needs the
     double-submit CSRF token plus a rotated auth cookie, and a replay from a background worker
     would carry neither, so the request would be rejected after the fact. The only thing SW-level
     sync would add is flushing while the tab is closed; today that waits for the next visit.

### Phase 2b: Audit Follow-ups (closed 2026-11-10)

A static audit of the auth, persistence, AI and CSP paths produced the fix plan in
[`docs/superpowers/plans/2026-11-10-security-hardening.md`](../superpowers/plans/2026-11-10-security-hardening.md).
All seven findings in that plan are closed; the only piece deliberately left is the CSP `script-src`
nonce, recorded as an accepted constraint above. Per-finding status lives in
[`status.md`](../internal/status.md) and the dated evidence in [`changelog.md`](../internal/changelog.md).

1. ✅ **Real client IP for account state (High).** `POST /auth/login` and the other auth/admin paths
   read `request.client.host`, which is the platform proxy behind Render, so the `(email, IP)`
   backoff collapses to per-email and anyone can lock a known account out; audit rows and
   “new device” mails record the proxy address. Fix: `get_real_client_ip()` at every site.
2. ✅ **Stale-write detection for profile JSON (High).** Notes, finance, reminders and watchlist are
   whole-document columns replaced on each save, so two devices overwrite each other. Add a
   `profile_version` compare-and-set and a `409` the UI reports instead of claiming success.
3. ✅ **Per-account AI quota (Medium).** `/ai/chat` is limited only per IP (30/min); a deployment key
   has no daily budget. Claim a per-user/day counter before an external model call.
4. ✅ **CSP without `'unsafe-inline'` scripts (Medium).** Pin the theme bootstrap by SHA-256 and drop
   the blanket `img-src http:`, keeping LAN camera origins behind an explicit env allow-list.
5. ✅ **No shipped default admin credentials (Medium).** Delete `scripts/admin/check_password.py` and
   make `create_admin.py` require `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
6. ✅ **Cookie lifetimes from settings (Low).** Replace the hardcoded `30*60` / `7*24*60*60`
   `max_age` values so changing `ACCESS_TOKEN_EXPIRE_MINUTES` cannot desynchronise them.
7. ✅ **Fail loudly when shared state is required (Low).** `REQUIRE_SHARED_STATE=true` makes startup
   refuse an in-memory limiter or a process-local WebSocket bus.

### Phase 2c: UX & Usability (shipped 2026-11-12 → 2026-11-19)

The same audit reviewed the signed-in UI; its full task list is in
[`docs/superpowers/plans/2026-11-10-ux-usability-pass.md`](../superpowers/plans/2026-11-10-ux-usability-pass.md).
All of it has shipped: the camera cache is account-scoped, notification read state syncs through the
account, data routes have skeletons and widgets have one shared empty/error/retry state, `ui/Button`
exists with the pill rule in `@layer base`, widgets mount as their card nears the viewport, and the
save-status/undo pass closed the last two gaps. Per-finding status is in [`status.md`](../internal/status.md).

### Phase 3: Smart AI Copilot & Auto Model Discovery (1–2 shipped 2026-11-22)

Full plan documented in [`docs/superpowers/plans/2026-11-20-smart-ai-copilot-roadmap.md`](../superpowers/plans/2026-11-20-smart-ai-copilot-roadmap.md):
1. **Unrestricted Q&A & General Prompting — Shipped (2026-11-22).** `build_system_prompt()` now declares two modes (general assistant / workspace grounding), so a recipe or coding question is answered from the model's own knowledge while workspace figures still come only from the context JSON.
2. **Auto Model Detection & Smart Prioritization — Shipped (2026-11-22).** A pasted key is sent to the provider's live `/models` list, `suggested_model()` picks a stable flash/mini id, `AISettingsCard.tsx` renders the reachable models as clickable chips, and the default stays `gemini-3.8-flash` — verified 2026-11-22 against Google's model list, where the 2.5 family is deprecated and served only to existing projects while 3.8 Flash is the current stable id.
3. **Agentic Function Calling — Planned.** Replace rigid regex parsing with native LLM function calling for notes, reminders, and finance entries.
4. **Conversation Memory & Markdown — Shipped (2026-11-22); Multimodal — Planned.** The drawer restores the last 40 messages per account (`scopedStorageKey('ai-copilot/history')`, cleared by the new header button) and renders replies through a dependency-free Markdown subset — headings, bullet/numbered lists, pipe tables, fenced code, quotes, `**bold**` and `` `code` `` — built from React elements, never `dangerouslySetInnerHTML`. The prompt now allows light Markdown instead of forbidding it. Receipt/slip image understanding is still planned.

### Phase 4: Accurate Session IP Tracking & Proxy Resolution (Shipped 2026-11-22)

Full plan documented in [`docs/superpowers/plans/2026-11-20-accurate-session-ip-tracking.md`](../superpowers/plans/2026-11-20-accurate-session-ip-tracking.md):
1. **Multi-Hop Proxy Resolution — Shipped.** `get_real_client_ip()` reads `x-vercel-forwarded-for` / `x-real-ip` behind the Vercel rewrite, gated by `TRUST_VERCEL_PROXY` (default off, because a caller that reaches the origin directly can forge those headers) and still only when the direct peer is a trusted proxy. Without the opt-in, listing the platform peer and Vercel's ranges in `TRUSTED_PROXY_IPS` walks the chain to the client instead.
2. **Dynamic Session IP Refresh — Shipped.** `AuthService.refresh_access_token(refresh_token, client_ip=…)` writes `session.ip_address` alongside `last_activity`, and `POST /auth/refresh` passes `get_real_client_ip(request)` in, so a device that moves from Wi-Fi to mobile data stops showing its login-time address.
3. **Device Session Visibility — Verified.** `MyDevicesCard.tsx` already labels the current row `อุปกรณ์นี้` and prints its IP + relative activity; `ActiveSessionsCard.tsx` prints the device and IP per row and refreshes every 30s. No change was needed once the address itself became correct.
