---
name: auth-surface-rules
description: Rules for touching ART Workspace's identity surface — endpoints that record a client IP, set or clear auth cookies, return a user payload, gate an admin action, or handle CSRF, sessions, 2FA and password reset. Use only for those files; ordinary CRUD endpoints and UI work must not load it.
when-to-use: Adding or editing anything that records identity/IP, issues or revokes a session, writes an auth cookie, returns user data to a client, or changes CSRF/2FA/password-reset behaviour.
paths: ["backend/app/api/v1/endpoints/auth.py", "backend/app/api/v1/endpoints/users.py", "backend/app/api/v1/endpoints/profile.py", "backend/app/api/v1/endpoints/system.py", "backend/app/api/v1/endpoints/websockets.py", "backend/app/core/security.py", "backend/app/core/rate_limit.py", "backend/app/core/totp.py", "backend/app/schemas/user.py", "backend/app/services/auth_service.py", "frontend/src/lib/api/**", "frontend/src/components/Auth/**"]
user-invocable: false
---

# Auth Surface Rules

Every rule below exists because this repository already shipped the bug it prevents. The finding IDs
(P1, P7, …) live in `docs/internal/status.md`.

## 1. Client IP — never `request.client.host`

```python
from app.core.rate_limit import get_real_client_ip
client_ip = get_real_client_ip(request)   # ✓ trusts X-Forwarded-For only from a trusted proxy
```

`request.client.host` is the Render proxy, so every account shares one address: the `(email, IP)` login
backoff collapses to per-email (anyone can lock a victim out for 5 minutes), and audit rows, session
rows and "new device" notices record the proxy. Finding **P1** lists ~20 call sites that still do this.
`users.py` and `system.py` do not import the helper yet — add the import, never an inline re-implementation.

## 2. Secrets never leave the server in a user payload

`UserResponse` must not serialise `external_notifications`, `web_push_subscription`, `ai_api_key_enc`,
TOTP secrets, recovery codes, VAPID private keys or raw tokens. The admin list leaked every account's
channel tokens and push keys once. When adding a column, ask: does this appear in any `GET /users*` or
`/profile/me`? Expose a boolean (`has_api_key`) or a masked suffix instead.

## 3. Cookie lifetimes come from settings

`access_token` uses `ACCESS_TOKEN_EXPIRE_MINUTES`, `refresh_token`/`csrf_token`/`user` use
`REFRESH_TOKEN_EXPIRE_DAYS`. Hardcoded `30*60` / `7*24*60*60` desynchronise the cookie from the token the
day someone changes the env (**P7**).

## 4. CSRF exemptions are a closed list

Exempt only what must work before a session exists: `/login`, `/register`, `/refresh`, `/csrf`,
`/forgot-password`, `/reset-password`. Everything else under `/api` that a browser calls with
`POST`/`PUT`/`PATCH`/`DELETE` needs the readable `csrf_token` cookie echoed in `X-CSRF-TOKEN`; failure is
`403 {"code":"csrf_failed"}`. A request with no session cookie keeps its normal `401`.

## 5. Failures leak nothing

`detail=str(e)` is banned. Log with `logger.exception` server-side and return a generic Thai message.
Auth paths must answer identically for unknown accounts (login, forgot-password) so they are not an
account-existence oracle.

## 6. Admin gates and the 2FA escape hatch

Admin-only routes use `get_current_admin_user`; a normal account gets `403`. `POST /users/{id}/reset-2fa`
refuses the caller's own account — a stolen admin session must not strip its own second factor. Any
forced logout writes `ADMIN_REVOKE_SESSION`; 2FA reset writes `ADMIN_RESET_2FA`.

## 7. Tokens at rest

Password-reset and verification tokens are stored as SHA-256 hashes, single-use, with a TTL and a
per-account cooldown. Sessions are revoked on password reset and on account deletion — a token issued a
minute earlier must stop working. Deleting an account is reversible for `USER_DELETE_RETENTION_DAYS`
(`users.deleted_at`), which is what keeps `audit_logs.user_id` resolvable.

## 8. User-supplied outbound targets

Webhook/LINE/URL targets pass `app.core.url_safety.ensure_public_http_url` (http(s) only, DNS resolved,
every answer public) and the outbound client does **not** follow redirects. Dispatching is admin-only.

## 9. Frontend side

- All authenticated calls go through `lib/api/fetchWithAuth.ts`: credentials, CSRF header, and the
  single-flight refresh. Do not add a parallel fetch path or a second refresh implementation.
- A `401` after a backend-confirmed refresh rejection logs out; a network error does not.
- Never cache a user payload containing secrets in localStorage; `offlineScope()` keys are per account.

## Tests that must exist beside the change

| Change | Extend |
|---|---|
| Anything reading a request IP | `tests/test_client_ip_accounting.py` (create per the 2026-11-10 plan) |
| Login / lockout / backoff | `tests/test_auth.py`, `tests/test_security_login_backoff_redis.py`, `tests/test_security_userlogin_limits.py` |
| Sessions / devices / revocation | `tests/test_active_sessions.py` |
| Cookie writes | `tests/test_auth_cookie_lifetimes.py` (create per the plan) |
| Payload shape | a test asserting the field is **absent** from the JSON, not merely `None` |

Run `pytest -q`, `flake8 app`, `mypy app`, and `alembic check` when a column changed.

## Done when

- No new `request.client.host`, no secret in a response model, no literal cookie lifetime.
- The mutation path is CSRF-covered or explicitly justified.
- A regression test fails against the previous code and passes against yours.
