# Security & Data-Integrity Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five defects a 2026-11-10 code audit found in the auth/IP accounting path, the whole-document JSON persistence model, AI cost control, the frontend CSP, and the dev scripts that ship default admin credentials.

**Architecture:** Each fix stays inside the layer that already owns the concern: real client IP comes from `core/rate_limit.get_real_client_ip` (already used by the limiter and the reset/logout paths); conflict detection adds one monotonic `profile_version` column on `users`, returned by `GET /profile/me` and required by blob writers, so a stale writer gets `409` instead of overwriting; the AI quota is a per-account daily counter row claimed atomically before an external model call; CSP drops `'unsafe-inline'` for scripts by moving the theme bootstrap into a static same-origin file; the default-credential scripts are removed from the tree.

**Tech Stack:** Python 3.11/3.14, FastAPI, async SQLAlchemy (asyncpg in production, aiosqlite in tests), Alembic, slowapi; Next.js 16, React 19, TypeScript, Tailwind v4, Vitest.

**Spec:** Audit findings below (2026-11-10), plus `docs/product/roadmap-features.md` → *Phase 2: Security & Platform Hardening*.

**Companion plan:** [`2026-11-10-ux-usability-pass.md`](./2026-11-10-ux-usability-pass.md) holds the UX/UI findings from the same audit; its Task 2 depends on the `profile_version` compare-and-set shipped here in Task 5.

## Audit findings this plan closes

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| P1 | Auth/admin paths read `request.client.host`, which is the platform proxy behind Render (uvicorn trusts `X-Forwarded-For` only from `127.0.0.1`), so every user shares one IP: the login backoff key `(email, ip)` collapses to *per-email*, letting anyone lock a victim out for 5 minutes; audit rows, session rows and “new device” emails record the proxy IP | `api/v1/endpoints/auth.py:356,504,659,676,1144,1309,1676,1726`; `users.py:199,252,425,473,555,642,719,781`; `profile.py:245,309`; `system.py:260`; `services/auth_service.py:244` | High |
| P7 | Cookie `Max-Age` is hardcoded (`30*60`, `7*24*60*60`) instead of `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS`, so changing the env desynchronises token and cookie lifetimes | `auth.py:417,424,740,748,780,1175-1196,1342-1363` | Low |
| P5 | Tracked dev scripts hardcode `admin@art.com` / `Admin@123` and one of them resets the password to `admin@123` | `backend/scripts/admin/create_admin.py`, `check_password.py` | Medium |
| P3 | `/ai/chat` is limited only per IP at 30/min; a server-side key has no per-account daily budget | `api/v1/endpoints/ai.py:32,649`; `AI_MAX_OUTPUT_TOKENS` | Medium |
| P2 | Notes, finance, reminders, watchlist, menu and layout are whole-document JSON columns replaced on every write: concurrent devices silently lose the other side’s rows | `models/user.py:35-66`; `services/user_service.py:533-573`; only finance has tombstones (`finance_deleted`) | High |
| P4 | Frontend CSP is `script-src 'self' 'unsafe-inline'` (theme bootstrap is inline) and `img-src https: http:` (blanket) | `frontend/next.config.js:48-52`; `frontend/src/app/layout.tsx:65-71` | Medium |
| P6 | Rate limit, login backoff and the WebSocket registry are process-local unless Redis is configured; nothing stops a multi-instance deploy from silently getting the wrong behaviour | `app/main.py:117-140`; `services/ws_bus.py` | Medium |

## Global Constraints

- Ponytail Principle: smallest surgical change that fixes the cause; no new runtime dependency (Redis stays optional; Redis client is already a transitive dependency via slowapi).
- Backend commands run as `cd backend && ./venv/Scripts/python.exe -m <tool>`; frontend as `cd frontend && npx <tool>`.
- Never run Prettier across the repository (it is not Prettier-clean); format only the lines you touch, matching surrounding style.
- No secret, credential or real API key may enter the repository — env files stay untracked.
- Thai user-facing copy, Apple HIG tokens (`var(--accent)`, `var(--ink)`, radius 18/11), `lucide-react` icons, `showSuccess`/`showError` toasts.
- Keep the suite green: backend coverage gate 75%, `flake8`, `mypy`; frontend `type-check`, `lint`, `npm test`, `npm run build`.
- Every task ends with its own tests passing; commit per task.

## Review Focus

1. **Spoofed forwarding headers.** `X-Forwarded-For` must only be believed when the direct peer is a trusted proxy; a public peer supplying the header must still be keyed by its socket address (`get_real_client_ip` already does this — do not re-implement it inline).
2. **Backoff must not become a lockout weapon.** Two clients with different real IPs must get independent buckets; the correct password from a fresh IP must still sign in while another IP is backed off.
3. **Quota boundary.** The daily counter resets on the Asia/Bangkok calendar day, and a request that is refused by the quota must not call the provider at all.
4. **Conflict behaviour.** A stale write must return `409` with the current version and leave stored data untouched; the UI must say so and refresh, never pretend the save succeeded.
5. **CSP regressions.** After removing `'unsafe-inline'`, the theme must still apply before first paint (no light-flash on a dark theme) and no other page may be blocked.

---

### Task 1: Use the real client IP everywhere account state is recorded (P1)

**Files:**
- Modify: `backend/app/api/v1/endpoints/auth.py` (lines 356, 504, 659, 676, 1144, 1309, 1676, 1726)
- Modify: `backend/app/api/v1/endpoints/users.py` (lines 199, 252, 425, 473, 555, 642, 719, 781)
- Modify: `backend/app/api/v1/endpoints/profile.py` (lines 245, 309), `system.py` (line 260)
- Test: `backend/tests/test_client_ip_accounting.py`

**Interfaces:**
- Consumes: `app.core.rate_limit.get_real_client_ip(request: Request) -> str` (already imported by `auth.py`, `profile.py`, `planner.py`).
- Produces: nothing new; `AuthService.login(..., ip_address=...)` keeps its signature and now receives the real address.

- [ ] **Step 1: Write the failing regression test**

```python
# backend/tests/test_client_ip_accounting.py
from app.models.audit_log import AuditLog
from sqlalchemy import select

async def test_login_backoff_is_keyed_by_forwarded_client_ip(client, make_user, db_session):
    await make_user(email="victim@example.com", password="SecretPass123")

    for _ in range(5):
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "victim@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": "203.0.113.7"},
        )
    assert r.status_code == 429

    # A different real client must not inherit the attacker's bucket.
    ok = await client.post(
        "/api/v1/auth/login",
        json={"email": "victim@example.com", "password": "SecretPass123"},
        headers={"X-Forwarded-For": "198.51.100.4"},
    )
    assert ok.status_code == 200, ok.text

async def test_failed_login_audit_records_forwarded_ip(client, make_user, db_session):
    await make_user(email="audit@example.com", password="SecretPass123")
    await client.post(
        "/api/v1/auth/login",
        json={"email": "audit@example.com", "password": "wrong"},
        headers={"X-Forwarded-For": "203.0.113.9"},
    )
    row = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action == "LOGIN_FAILED").order_by(AuditLog.id.desc())
        )
    ).scalars().first()
    assert row is not None and row.ip_address == "203.0.113.9"
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_client_ip_accounting.py -v`
Expected: FAIL — the second login answers `429` (shared bucket keyed by `127.0.0.1`) and the audit row holds `127.0.0.1`.

- [ ] **Step 3: Replace the call sites**

In each listed line, replace

```python
client_ip = request.client.host if request.client else None
ip_address=request.client.host if request.client else None
```

with `client_ip = get_real_client_ip(request)` / `ip_address=get_real_client_ip(request)`, adding `from app.core.rate_limit import get_real_client_ip` where the module does not already import it (`users.py`, `system.py`). Do not change what is stored or logged.

- [ ] **Step 4: Re-run the new test, then the auth suites**

Run: `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_client_ip_accounting.py tests/test_security_login_backoff_redis.py tests/test_security_userlogin_limits.py tests/test_active_sessions.py -v`
Expected: all pass; the backoff test still sees 429 after 5 failures from one IP.

- [ ] **Step 5: Lint, type-check, commit**

Run: `cd backend && ./venv/Scripts/python.exe -m flake8 app && ./venv/Scripts/python.exe -m mypy app`
Commit: `fix(auth): key lockout and audit on the real client IP`

---

### Task 2: Derive cookie lifetimes from settings (P7)

**Files:**
- Modify: `backend/app/api/v1/endpoints/auth.py` (all `max_age=` sites listed above)
- Test: `backend/tests/test_auth_cookie_lifetimes.py`

**Interfaces:**
- Consumes: `settings.ACCESS_TOKEN_EXPIRE_MINUTES`, `settings.REFRESH_TOKEN_EXPIRE_DAYS`.
- Produces: module-level helpers `_access_cookie_max_age() -> int` and `_refresh_cookie_max_age() -> int` in `auth.py`, used by every cookie write.

- [ ] **Step 1: Write the failing test** — monkeypatch `app.api.v1.endpoints.auth.settings.ACCESS_TOKEN_EXPIRE_MINUTES = 45` and `REFRESH_TOKEN_EXPIRE_DAYS = 3`, log in, then assert the `access_token` `Set-Cookie` contains `Max-Age=2700` and `refresh_token` contains `Max-Age=259200`.
- [ ] **Step 2: Run it** — `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_auth_cookie_lifetimes.py -v` → FAIL (`Max-Age=1800`).
- [ ] **Step 3: Implement the helpers and use them** at every `max_age=` in the login, refresh and Google-callback responses; keep the `csrf_token`/`user` cookies at the refresh lifetime via `_refresh_cookie_max_age()`.
- [ ] **Step 4: Re-run the test plus `tests/test_auth.py` (or the auth-related suite)** → pass.
- [ ] **Step 5: Commit** — `fix(auth): keep cookie lifetimes in step with token settings`

---

### Task 3: Remove default-credential admin scripts (P5)

**Files:**
- Delete: `backend/scripts/admin/check_password.py`
- Modify: `backend/scripts/admin/create_admin.py`, `create_admin_auto.py`, `backend/scripts/README.md`

**Interfaces:**
- Produces: `create_admin.py` reading `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or CLI args) and refusing to run when either is missing; no default values remain in source.

- [ ] **Step 1: Make the script refuse defaults**

```python
email = os.environ.get("ADMIN_EMAIL")
password = os.environ.get("ADMIN_PASSWORD")
if not email or not password:
    sys.exit("Set ADMIN_EMAIL and ADMIN_PASSWORD; no default credentials are shipped.")
```

- [ ] **Step 2: Delete `check_password.py`** (`git rm`), and update `backend/scripts/README.md` to document the env-based invocation.
- [ ] **Step 3: Prove nothing references the removed file** — `git grep -n "check_password"` → no hits outside history.
- [ ] **Step 4: Commit** — `chore(scripts): stop shipping default admin credentials`

---

### Task 4: Per-account daily AI quota (P3)

**Files:**
- Create: `backend/app/models/ai_usage.py`, `backend/app/services/ai_quota.py`
- Create: `backend/alembic/versions/<rev>_add_ai_usage_daily.py`
- Modify: `backend/app/models/__init__.py`, `backend/app/core/config.py` (`AI_DAILY_REQUESTS_PER_USER: int = 50`), `backend/app/api/v1/endpoints/ai.py` (`/chat`, `GET /settings`)
- Test: `backend/tests/test_ai_quota.py`

**Interfaces:**
- Produces: `async def claim_ai_request(db: AsyncSession, user_id: int, day: date, limit: int) -> bool` — atomically increments today’s counter and returns `False` when the account is already at `limit`; `AI_USAGE_LIMIT_EXCEEDED_CODE = "ai_quota_exceeded"`.
- Consumes: `settings.AI_DAILY_REQUESTS_PER_USER`.

- [ ] **Step 1: Write failing tests** — (a) 50 successful claims then the 51st returns `False`; (b) a second day resets; (c) `/ai/chat` with a server key and an exhausted quota answers `429` with `code == "ai_quota_exceeded"` and the provider callable is never invoked (monkeypatch `call_ai_model`); (d) an account with its own key is not blocked.
- [ ] **Step 2: Run them → FAIL.**
- [ ] **Step 3: Add the model + migration.** `ai_usage_daily(id, user_id FK, day DATE, requests INT, unique(user_id, day))`; claim with a dialect-aware upsert (`insert(...).on_conflict_do_update` for Postgres, `sqlite insert` for tests), no read-modify-write race.
- [ ] **Step 4: Wire the endpoint.** In `/ai/chat`, before `call_ai_model`, claim only when `resolve_ai_provider()` returns a deployment key (no `user.ai_api_key_enc`); on refusal raise `HTTPException(429, detail="ใช้โควต้า AI ของวันนี้ครบแล้ว …")` with the machine code. Return `daily_used` / `daily_limit` from `GET /ai/settings`.
- [ ] **Step 5: Run the new tests + `tests/test_ai*.py`, then `alembic check` on a throwaway SQLite DB** → pass.
- [ ] **Step 6: Commit** — `feat(ai): cap daily model calls per account`

---

### Task 5: Version the JSON profile blobs and reject stale writes (P2, backend)

**Files:**
- Modify: `backend/app/models/user.py` (`profile_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)`), `backend/app/schemas/user.py` (blob update schemas gain optional `base_version: int | None`)
- Create: `backend/alembic/versions/<rev>_add_profile_version.py`
- Modify: `backend/app/services/user_service.py` (all `update_*` blob writers), `backend/app/api/v1/endpoints/profile.py` (quick-notes / finance / watchlist / camera endpoints), `backend/app/api/v1/endpoints/planner.py` (`POST /planner/reminders` writes `users.personal_reminders`), `backend/app/api/v1/endpoints/auth.py` (session/profile payload)
- Test: `backend/tests/test_profile_conflict.py`

**Interfaces:**
- Produces: every blob write returns the new version; `GET /profile/me` includes `profile_version`; mismatch raises `HTTPException(409, detail=...)` with body `{"code": "profile_conflict", "profile_version": <current>}`.

- [ ] **Step 1: Write failing tests** — (a) two saves with the same `base_version` → second gets `409` and stored notes are the first save; (b) a save with the freshly returned version succeeds and increments the counter; (c) `PUT /profile/me` without `base_version` (older clients) keeps current last-write-wins behaviour for one release.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement the compare-and-set.** In one transaction: `UPDATE users SET <column>=:value, profile_version=profile_version+1 WHERE id=:id AND profile_version=:base`; `rowcount == 0` → 409 with the current version. Apply to quick-notes, finance, planner reminders and watchlist (layout/menu stay best-effort, but still bump the counter).
- [ ] **Step 4: Migration + `alembic check` on a temp SQLite file** (server default `0`, `NOT NULL`).
- [ ] **Step 5: Run the profile/auth suites** → pass.
- [ ] **Step 6: Commit** — `feat(profile): detect and reject stale JSON blob writes`

---

### Task 6: Adopt conflict handling in the frontend (P2, client)

**Files:**
- Create: `frontend/src/lib/api/profileBlobs.ts`
- Create: `frontend/src/lib/api/profileBlobs.test.ts`
- Modify: `frontend/src/components/Widgets/QuickNotesWidget.tsx`, `FinanceWidget.tsx`, `PersonalReminders.tsx`, `CalendarWidget.tsx`, `frontend/src/app/(main)/share-target/ShareTargetClient.tsx`, `frontend/src/components/AICopilot/AICopilotDrawer.tsx`, `frontend/src/components/Profile/WorkspaceBackupCard.tsx`
- Modify: `frontend/src/components/Auth/AuthProvider.tsx` (store `profile_version` with the cached user)

**Interfaces:**
- Produces: `saveProfileBlob<T>(path: string, body: T, options: { baseVersion?: number; cacheKey?: string }): Promise<{ ok: true; profileVersion: number } | { ok: false; conflict: true; profileVersion: number }>`; on `409` it refreshes the cache from `GET /profile/me`, shows `showError('ข้อมูลถูกแก้ไขจากอุปกรณ์อื่น ระบบโหลดข้อมูลล่าสุดให้แล้ว')`, and returns `{ ok: false }`.

- [ ] **Step 1: Write failing tests** — a mocked `fetchWithAuth` returning `409 {code:"profile_conflict", profile_version: 9}` makes `saveProfileBlob` return `conflict: true`, call the cache refresh once, and never call `writeCached` with the rejected payload.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement the helper and switch the listed call sites** to pass `baseVersion` from the stored `profile_version`, updating it from every successful save.
- [ ] **Step 4: Run `npx vitest run src/lib/api/profileBlobs.test.ts` plus the touched widget tests**, then `npm run type-check` → pass.
- [ ] **Step 5: Commit** — `fix(profile): handle concurrent edits instead of overwriting them`

---

### Task 7: Tighten the frontend CSP without a theme flash (P4)

**Files:**
- Create: `frontend/theme-init.js` (CommonJS: `module.exports = THEME_INIT_SCRIPT;`), `frontend/theme-init.d.ts`
- Modify: `frontend/src/app/layout.tsx` (import the string, keep the inline tag but let the build hash it), `frontend/next.config.js` (compute `sha256` from the same module and put it in `script-src`)
- Modify: `frontend/next.config.js` `img-src` → `'self' data: https: blob:` plus `process.env.NEXT_PUBLIC_CAMERA_ORIGINS` when set

- [ ] **Step 1:** Move the theme bootstrap string verbatim into `frontend/theme-init.js`; import it in `layout.tsx` so the rendered tag is byte-identical to the module.
- [ ] **Step 2:** In `next.config.js`, `require('./theme-init')`, hash it (`crypto.createHash('sha256').update(script).digest('base64')`) and emit `script-src 'self' 'sha256-…' …` — remove `'unsafe-inline'` from `script-src` only.
- [ ] **Step 3:** Build and inspect the served header: `cd frontend && npm run build && npm start`, then `curl -sI http://localhost:3000/login | grep -i content-security-policy` → the hash is present and `'unsafe-inline'` is absent from `script-src`.
- [ ] **Step 4:** Load `/login` and `/dashboard` (Playwright smoke) and assert no `Refused to execute inline script` console error and `document.documentElement.dataset.theme` is set before paint.
- [ ] **Step 5: Commit** — `fix(security): pin the theme script by hash and narrow img-src`

---

### Task 8: Fail loudly on an unsafe multi-instance deploy (P6)

**Files:**
- Modify: `backend/app/core/config.py` (`REQUIRE_SHARED_STATE: bool = False`), `backend/app/main.py` (`log_shared_state_limitations` raises `RuntimeError` when the flag is set and `SLOWAPI_STORAGE_URI == "memory://"` or `WS_BROADCAST_REDIS_URL` is empty), `README.md` (*Horizontal scaling* section)
- Test: `backend/tests/test_shared_state_guard.py`

- [ ] **Step 1: Write the failing test** — with `REQUIRE_SHARED_STATE=true` and memory storage, calling `log_shared_state_limitations()` raises `RuntimeError` mentioning `SLOWAPI_STORAGE_URI`.
- [ ] **Step 2:** Implement the guard (flag default `False`, so single-instance deployments are unaffected) and update the README.
- [ ] **Step 3:** Run the test + `tests/test_config*.py` → pass; commit `feat(ops): refuse to start when shared state is required but absent`.

---

### Task 9: Verification & release gate

- [ ] Backend: `cd backend && ./venv/Scripts/python.exe -m pytest` (coverage ≥ 75%), `flake8 app`, `mypy app`, and `alembic upgrade head` + `alembic check` on a throwaway SQLite file.
- [ ] Frontend: `cd frontend && npm run type-check && npm run lint && npm test && npm run build`.
- [ ] Manual, on the deployed origin: sign in from two browsers, save a note on each within a second (expect the conflict toast, no lost row); confirm the second account still signs in after five wrong passwords from a third client; check the login page has no theme flash and no CSP violation in the console.
- [ ] Deployment note for the operator: run `alembic upgrade head` (Render `preDeployCommand` already does), then verify `GET /health/ready` and one `/api/v1/auth/session` round-trip.
- [ ] Commit any remaining docs (roadmap status) — `docs(security): record the hardening pass`.
