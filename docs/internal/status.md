# ART Workspace — Current Status

**Verified:** November 11, 2026 · `main` at `612243a` plus the CI repair below · Windows dev
machine, Python 3.14.6 local and 3.11 in a throwaway venv (what CI runs), Node 26

> **What this file is.** The single place that states what is true *right now*: verified numbers, what
> that verification covered, and every known gap with its status. `architecture.md` explains how the
> system works; `changelog.md` explains how it got here. If a number here disagrees with another
> document, this file wins and the other document is wrong.

---

## 1. Verified state

| Check | Command | Result |
|---|---|---|
| Backend tests | `cd backend && ./venv/Scripts/python.exe -m pytest -q` | **620 passed, 1 skipped**; coverage **84.25%** on 3.14 and **76.48%** on 3.11 (gate 75%), both with no `.env` — i.e. the CI configuration |
| Backend lint | `./venv/Scripts/python.exe -m flake8 app` | clean |
| Backend types | `./venv/Scripts/python.exe -m mypy app` | clean, 68 source files |
| Migrations | `alembic upgrade head` + `alembic check` on a throwaway SQLite file | full chain applies, **no drift** |
| Frontend tests | `cd frontend && npx vitest run` | **387 passed**, 60 files |
| Frontend types | `npx tsc --noEmit` | clean |
| Frontend lint | `npx eslint .` | clean |

The CI job runs the suite on 3.11 **and with no `.env`**, so the numbers above were measured that
way. Both differences matter: 3.11 measures ~8 points lower than 3.14, and a local `.env` silently
changes behaviour the suite can assert on — that is exactly how `test_ai_settings.py` passed here and
failed in CI (the test sent `http://` and expected the private-address error, which a `DEBUG=False`
CI only reaches after the earlier https-scheme rejection). The skipped test is
`test_security_headers.py`'s docs check, which skips itself when `DEBUG=False`. Re-measure with
`mv .env .env.bak` before running whenever a test asserts on configuration-driven behaviour.

**Not re-run in this pass** (last green in CI or in the pass noted in `changelog.md`): `next build`,
Playwright smoke (3), axe on the auth pages, the live register→login E2E, `pip-audit`, and every
deployed-only check in §5. Two interpreter differences matter when reading coverage: Python 3.11
(what CI runs) measures lower than 3.14 on this suite, and the gate is deliberately 75 rather than 80.

## 2. Open findings from the November 10, 2026 audit

Both fix plans exist and are tracked in `docs/product/roadmap-features.md` (Phase 2b / 2c). **None of
them has shipped.** Confirmed on `623fd3a` by inspecting the tree: no `app/models/ai_usage.py`, no
`app/services/ai_quota.py`, no `frontend/src/components/ui/Button.tsx`, no `frontend/theme-init.js`,
no `profile_version` column, and `backend/scripts/admin/check_password.py` still exists.

### Security and data integrity — [`plans/2026-11-10-security-hardening.md`](../superpowers/plans/2026-11-10-security-hardening.md)

| ID | Finding | Severity | Status |
|---|---|---|---|
| P1 | Auth/admin paths read `request.client.host` (the Render proxy), so the `(email, IP)` login backoff collapses to per-email — anyone can lock a known account out — and audit rows, session rows and "new device" mails record the proxy IP | High | Open |
| P2 | Notes, finance, reminders, watchlist, menu and layout are whole-document JSON columns replaced on every write; concurrent devices silently lose rows. Finance is the only one with tombstones | High | Open |
| P3 | `/ai/chat` is limited per IP only (30/min); a deployment key has no per-account daily budget | Medium | Open |
| P4 | Frontend CSP keeps `script-src 'unsafe-inline'` (inline theme bootstrap) and a blanket `img-src http:` | Medium | Open |
| P5 | `backend/scripts/admin/*` ship default admin credentials (`admin@art.com` / `Admin@123`) | Medium | Open |
| P6 | Rate limit, login backoff and the WebSocket registry are process-local unless Redis is configured; nothing stops a multi-instance deploy from running silently wrong | Medium | Open |
| P7 | Cookie `Max-Age` values are hardcoded (`30*60`, `7*24*60*60`) instead of derived from `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | Low | Open |

### UX and usability — [`plans/2026-11-10-ux-usability-pass.md`](../superpowers/plans/2026-11-10-ux-usability-pass.md)

| ID | Finding | Size | Status |
|---|---|---|---|
| U1 | Camera stream list is cached under an unscoped key and survives logout, so the next account on a shared browser sees the previous account's cameras | S | Open |
| U2 | Notification read/dismissed state is localStorage-only — clearing on the phone leaves the desktop badge lit | M | Open |
| U3 | Only 3 of 14 pages have `loading.tsx` (`camera`, `dashboard`, `profile`); admin/audit/notifications render an empty frame | S–M | Open |
| U4 | Four widgets render a blank card when their API fails, with no message or retry | S | Open |
| U5 | No shared `Button` (`components/ui/` has Dialog, PageHeader, SegmentedControl, Select, Switch); an unlayered `button { border-radius: 9999px }` beats Tailwind, which is why card-shaped buttons needed `!` overrides | M | Open |
| U6 | Toasts are fixed top-centre, under the mobile header and notch | S | Open |
| U7 | axe covers only `/login`, `/register`, `/verify-email`; no signed-in surface is audited | M | Open |
| U8 | Small widgets are half-width from `md`, squeezing charts at 768px | M | Open |
| U9 | The dashboard drag handle is ~13px tall, far under the 44px touch target | S | Open |
| U10 | Widgets are keyboard-sortable but nothing tells the user how | S | Open |
| U11 | Autosave confirms nothing — no signal that the server accepted the change | M | Open |
| U12 | Quick notes cannot be undone after delete (finance entries can) | S | Open |
| U13 | All enabled widgets mount on page entry (13 `dynamic()` imports) | M | Open |
| U14 | The bell re-derives weather/oil numbers from the same caches the widgets fetch, duplicating work and risking different values | M | Open |

## 3. Open infrastructure risk

| Item | Status |
|---|---|
| Backend CI was red from 2026-11-10 to 2026-11-11 | **Closed** — two causes, both fixed: 3.11 coverage had fallen to 74.32% under the 75 gate (three new test modules restored it) and `test_ai_settings_rejects_private_base_url` only passed when a local `.env` set `DEBUG` (it now uses an `https://` URL, and a new test pins the non-debug scheme rejection). Verified at 620 passed / 76.48% on 3.11 with no `.env`. See `changelog.md`. |
| Frontend CI job failed once on `94c9ede` with every later step skipped | **Closed** — the same job passed end to end on `612243a` (387 tests, build, smoke, a11y, live E2E), so the failure was a flake and not a deterministically broken test. Nothing was changed for it; if it recurs, name the test from the run log. |

## 4. Accepted constraints

These are decisions, not defects — recorded so they are not re-litigated as bugs:

| Constraint | Detail |
|---|---|
| Single instance by default | Rate limiting and the WebSocket registry are process-local; Redis paths exist (`SLOWAPI_STORAGE_URI`, `WS_BROADCAST_REDIS_URL`) and startup logs a `[SCALING]` notice. |
| Third-party market data has no SLA | Yahoo Finance / Frankfurter / Thai Gold / Bangchak / Open-Meteo may throttle; widgets show the last known value or an empty block instead of failing the page. |
| Partial i18n | A `th`/`en` catalogue exists in `lib/i18n/messages.ts` and drives part of the tree (last counted 12 of 97 components). Finishing it is a per-screen migration, not a switch. |
| Partial frontend coverage | 387 unit tests, but route-level tests exist only for `login`, `register`, `forgot-password` and `share-target`. `dashboard`, `profile`, `admin`, `audit`, `camera`, `notifications`, `verify-email`, `reset-password` and `login-success` have none. |
| Whole-document JSON blobs | Cheapest model that worked for single-user-per-account data; conflict detection is finding P2. |
| No password-reset email in CI | Password recovery is shipped, but delivery depends on `EMAIL_BACKEND` being configured on Render — unverified from a local checkout. |

## 5. Deployed-only checks that remain open

These need the real environment and cannot be closed locally:

1. Notification WebSocket origin on the deployed frontend (`NEXT_PUBLIC_WS_URL` vs `/api` rewrite).
2. Render boot log for the CSP/CORS posture, and a curl of the served CSP header.
3. `EMAIL_BACKEND` on Render (password reset + new-device notices actually arrive).
4. Pointing `SLOWAPI_STORAGE_URI` at Redis and confirming shared buckets across instances, if the
   deployment ever runs more than one instance.
5. `alembic upgrade head` against the production database before the backend deploy (Render's
   `preDeployCommand` runs it; confirm it did).

## 6. Document ownership

| Question | Owner |
|---|---|
| How is the system built? | `docs/internal/architecture.md` |
| What is true right now, what is broken? | this file |
| When did a behaviour change, and why? | `docs/internal/changelog.md` |
| What exists in the product, what is planned? | `docs/product/roadmap-features.md` |
| Users, personality, anti-references | `PRODUCT.md` |
| Colour, type, radii, motion | `DESIGN.md` + `design-system/art-workspace/MASTER.md` |
| How do I run it / deploy it? | `README.md`, `docs/setup/*` |

Rule that keeps this set honest: **a dated narrative belongs in `changelog.md` only.** When a change
lands, update `status.md` (numbers and gaps) and `architecture.md` (if the shape changed), then append
to `changelog.md`. Do not add a new dated section to `status.md`.

## 7. How to refresh this file

```bash
cd backend && ./venv/Scripts/python.exe -m pytest -q           # count + coverage
cd backend && ./venv/Scripts/python.exe -m flake8 app
cd backend && ./venv/Scripts/python.exe -m mypy app
cd backend && DATABASE_URL="sqlite+aiosqlite:///./_check.db" \
  ./venv/Scripts/python.exe -m alembic upgrade head && \
  ./venv/Scripts/python.exe -m alembic check && rm -f _check.db
cd frontend && npx vitest run
cd frontend && npx tsc --noEmit && npx eslint .
```

Update the **Verified** line, the table in §1, and any finding whose status changed. If a finding
shipped, move it out of §2 and add the pass to `changelog.md` with its evidence.
