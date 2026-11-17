# 2FA Mobile Recovery UX & Trusted Device Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 2FA recovery code mobile keyboard lockout bug by providing a dedicated recovery mode in the 2FA Dialog, and implement a secure, stateless "Trust this device (30 days)" mechanism so users don't have to re-enter TOTP on their regular browser.

**Architecture:**
- **Frontend Dialog UX**: Add a seamless toggle in `login/page.tsx` between 6-digit TOTP mode (`inputMode="numeric"`, `placeholder="123456"`, spacing) and Recovery Code mode (`inputMode="text"`, uppercase, `placeholder="ABCDE-12345"`, normal tracking). Add a "จดจำอุปกรณ์นี้ 30 วัน" checkbox to send `trust_device: true`.
- **Backend Stateless Trusted Device Token**: Issue an HMAC-signed JWT (`type: "trusted_device"`, 30-day TTL) bound to `user_id` and a dynamic salt based on `sha256(hashed_password + totp_secret)`. Stored in an HTTP-only `trusted_device` cookie. Automatically invalidated whenever the password changes or 2FA is reset/disabled. Zero database migrations needed.

**Tech Stack:** FastAPI, Python 3.14, PyJWT, Next.js 16, React 19, Tailwind CSS v4, Lucide React, Vitest, Pytest.

---

## Global Constraints
- Ponytail Principle: Minimal surgical code, zero bloat, no extra database tables.
- Adhere to `auth-surface-rules`: Never `request.client.host`, use `get_real_client_ip(request)`; cookie lifetimes from settings; HTTP-only cookies; fail safely.
- Keep tests 100% green: frontend `npm run test`, backend `pytest` without regression.

## Review Focus
1. Mobile keyboard on iOS/Android: Recovery code mode must use `inputMode="text"` and `autoCapitalize="characters"`.
2. Token invalidation: Changing password or disabling 2FA must immediately invalidate any previously issued trusted device token.
3. Cookie safety: `trusted_device` cookie must be `httponly=True`, `samesite="lax"`, and use secure flags consistent with environment.

---

### Task 1: Backend Trusted Device Token Helpers & Logic (TDD)

**Files:**
- Modify: `backend/app/core/security.py` (add `create_trusted_device_token`, `verify_trusted_device_token`, `get_user_2fa_salt`)
- Modify: `backend/app/schemas/user.py` (add `trust_device: bool = False` to `UserLogin`)
- Modify: `backend/app/services/auth_service.py` (wire trusted device token verification and token generation)
- Modify: `backend/app/api/v1/endpoints/auth.py` (read `trusted_device` cookie on login, set cookie on response)
- Create: `backend/tests/test_trusted_device_2fa.py`

- [ ] **Step 1: Write unit tests in `backend/tests/test_trusted_device_2fa.py`**
- [ ] **Step 2: Implement security token helpers in `backend/app/core/security.py`**
- [ ] **Step 3: Update `UserLogin` schema in `backend/app/schemas/user.py`**
- [ ] **Step 4: Update `AuthService.login` in `backend/app/services/auth_service.py`**
- [ ] **Step 5: Wire cookie handling in `backend/app/api/v1/endpoints/auth.py`**
- [ ] **Step 6: Run `pytest backend/tests/test_trusted_device_2fa.py` and verify all tests pass**

---

### Task 2: Frontend 2FA Dialog Recovery Mode & Trust Device Checkbox

**Files:**
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/login/page.test.tsx`

- [ ] **Step 1: Write tests in `frontend/src/app/login/page.test.tsx` for recovery code mode and trust device checkbox**
- [ ] **Step 2: Add `isRecoveryMode` and `trustDevice` state to `login/page.tsx`**
- [ ] **Step 3: Implement mode toggle UI and dynamic input attributes in the 2FA Dialog**
- [ ] **Step 4: Add "จดจำอุปกรณ์นี้ 30 วัน" checkbox to 2FA Dialog**
- [ ] **Step 5: Run `npx vitest run src/app/login/` and verify all tests pass**

---

### Task 3: Full Verification & Quality Checks

- [ ] **Step 1: Run full backend test suite (`pytest`)**
- [ ] **Step 2: Run full frontend test suite (`npm run test`)**
- [ ] **Step 3: Run type checks (`npx tsc --noEmit` and `mypy app`)**
- [ ] **Step 4: Commit and present verified results**
