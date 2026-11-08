# Real Web Push Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement true end-to-end Web Push notifications from FastAPI backend to browser Service Worker via VAPID (RFC 8291/8292), allowing notifications on mobile devices even when the app tab is closed.

**Architecture:** 
1. The FastAPI backend generates or loads VAPID P-256 keys and exposes the public key via `GET /api/v1/profile/web-push/vapid-key`.
2. Frontend `useWebPush` hook retrieves the public key and registers a native push subscription with `PushManager.subscribe()`, storing endpoint and auth/p256dh keys in the user database.
3. Backend service `web_push_service.py` signs and dispatches real push payloads asynchronously via `pywebpush.webpush_async()`.
4. The service worker (`sw.ts`) receives incoming `push` events, displaying native OS notifications and routing clicks to the targeted URL.

**Tech Stack:** 
- Backend: Python 3.11, FastAPI, `pywebpush`, `py-vapid`, `cryptography`, `aiohttp`, SQLModel.
- Frontend: Next.js 15, TypeScript, Serwist Service Worker (`sw.ts`), React 19.

---

## Global Constraints
- Adhere to Ponytail Principle: Surgical minimal changes, zero bloat, reuse existing database columns (`user.web_push_subscription`).
- Adhere to Apple HIG and existing PWA architecture.
- Keep test suite 100% green: all 342 frontend tests and 526 backend tests must pass with >= 75% coverage.

## Review Focus
1. VAPID public key must be an 87-character URL-safe base64 string matching the uncompressed P-256 point format required by Web Push browsers.
2. If VAPID keys are missing from `.env`, backend must auto-generate a valid keypair gracefully so local development and test runs never crash.
3. In `profile/web-push/test`, calling test notification must execute real backend push dispatch, falling back gracefully if no subscription exists yet.
4. Handling HTTP 404/410 from Push Service: If an endpoint is revoked or expired, the backend must safely clean up the dead subscription.
5. Service Worker `push` event must correctly deserialize JSON payloads (`title`, `body`, `icon`, `url`).

---

### Task 1: Backend VAPID Key Settings & Verification

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`
- Modify: `backend/tests/test_config_env_template.py`

- [ ] Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to `Settings` in `backend/app/core/config.py`.
- [ ] Add `VAPID_PUBLIC_KEY=` to `backend/.env.example`.
- [ ] Remove `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` from `NOT_A_SETTINGS_FIELD` in `backend/tests/test_config_env_template.py` so they are validated as real settings.
- [ ] Run `pytest backend/tests/test_config_env_template.py` to confirm settings configuration passes.

---

### Task 2: Backend Web Push Service (`web_push_service.py`)

**Files:**
- Create: `backend/app/services/web_push_service.py`
- Create: `backend/tests/test_web_push_service.py`

- [ ] Implement `get_vapid_keypair()` with fallback key generation using `py-vapid` and `cryptography`.
- [ ] Implement `get_vapid_public_key() -> str` exporting URL-safe base64 uncompressed public key.
- [ ] Implement `async def send_web_push(subscription_info: dict, payload: dict) -> bool` using `pywebpush.webpush_async`.
- [ ] Implement `async def send_web_push_to_user(db: AsyncSession, user: User, title: str, body: str, url: str = "/dashboard") -> bool` with automatic 404/410 expired subscription pruning.
- [ ] Write unit tests in `backend/tests/test_web_push_service.py` covering key generation, export, push payload dispatch, and error handling.
- [ ] Run `pytest backend/tests/test_web_push_service.py` to verify.

---

### Task 3: Backend API Endpoints for VAPID Key & Real Test Push

**Files:**
- Modify: `backend/app/api/v1/endpoints/profile.py`
- Test: `backend/tests/test_web_push_endpoints.py`

- [ ] Add endpoint `GET /api/v1/profile/web-push/vapid-key` returning `{"public_key": get_vapid_public_key()}`.
- [ ] Update endpoint `POST /api/v1/profile/web-push/test` to trigger `send_web_push_to_user()` and return delivery status.
- [ ] Write integration test verifying both endpoints in `backend/tests/test_web_push_endpoints.py`.
- [ ] Run all backend tests to ensure coverage remains >= 75%.

---

### Task 4: Frontend Web Push Client Integration

**Files:**
- Modify: `frontend/src/hooks/useWebPush.ts`
- Modify: `frontend/src/hooks/useWebPush.test.ts`

- [ ] Add `urlBase64ToUint8Array` utility to convert VAPID public key.
- [ ] Update `subscribe()` to fetch the VAPID public key from `/api/v1/profile/web-push/vapid-key` and pass `applicationServerKey` to `pushManager.subscribe()`.
- [ ] Send the real push subscription (`endpoint`, `keys.p256dh`, `keys.auth`) to `/api/v1/profile/web-push`.
- [ ] Update `sendTestNotification()` to trigger real backend push while gracefully handling fallback.
- [ ] Update `useWebPush.test.ts` to assert against the updated flow.
- [ ] Run `npm run test` in `frontend` to verify all 48 test suites pass.

---

### Task 5: End-to-End Verification & Deployment

- [ ] Run full backend test suite (`pytest`) with coverage verification.
- [ ] Run full frontend test suite (`vitest`), `type-check`, and `lint`.
- [ ] Stage, commit, and push changes to `main` for Vercel and Render deployment.
