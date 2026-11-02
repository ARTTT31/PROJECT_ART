/**
 * Authenticated fetch helper with automatic cookie-based session/token refresh
 * and double-submit-cookie CSRF protection.
 */

import { parseJsonWithSchema, type ResponseModelParsed } from './schemas';
import { getApiBaseUrl } from './apiBase';
import type { z } from 'zod';

// Empty in the default browser deployment, which means the same-origin /api
// rewrite (first-party cookies). `getApiBaseUrl()` explains the escape hatch.
const API_URL = getApiBaseUrl();

// When the API lives on another origin its cookies belong to that origin, so a
// `csrf_token` in `document.cookie` here is unrelated (and may be stale from an
// earlier same-origin deployment). Only the cookie this origin actually owns is
// safe to echo back.
const API_IS_CROSS_ORIGIN = /^https?:\/\//i.test(API_URL);

// ── CSRF (double-submit cookie) ──────────────────────────────
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_ENDPOINT = '/api/v1/auth/csrf';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Fallback for deployments where the CSRF cookie lives on the API origin and
// is therefore not readable from `document.cookie`.
let csrfTokenCache: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(CSRF_COOKIE.length + 1));
  } catch {
    return null;
  }
}

async function requestCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}${CSRF_ENDPOINT}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const token = body?.data?.csrf_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** Return the current CSRF token (cookie first, API fallback, then memory). */
export async function getCsrfToken(): Promise<string | null> {
  const fromCookie = API_IS_CROSS_ORIGIN ? null : readCsrfCookie();
  if (fromCookie) {
    csrfTokenCache = fromCookie;
    return fromCookie;
  }
  if (csrfTokenCache) return csrfTokenCache;
  if (!csrfTokenPromise) {
    csrfTokenPromise = requestCsrfToken().finally(() => {
      csrfTokenPromise = null;
    });
  }
  csrfTokenCache = await csrfTokenPromise;
  return csrfTokenCache;
}

// ── Shared refresh state ─────────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<{ success: boolean; isUnauthenticated: boolean }> | null = null;

async function refreshAccessToken(): Promise<{ success: boolean; isUnauthenticated: boolean }> {
  // Use 45-second timeout for Render serverless cold-start tolerance
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401 || res.status === 403) {
      // Explicitly rejected by backend (refresh token expired/invalid/revoked)
      return { success: false, isUnauthenticated: true };
    }

    if (!res.ok) {
      // Temporary server error (500/502/503/504) - keep local session alive
      return { success: false, isUnauthenticated: false };
    }

    const data = await res.json();
    if (data?.result === 'success') {
      window.dispatchEvent(new Event('auth-login'));
      return { success: true, isUnauthenticated: false };
    }

    return { success: false, isUnauthenticated: false };
  } catch {
    clearTimeout(timeoutId);
    // Timeout or network offline - DO NOT log out user
    return { success: false, isUnauthenticated: false };
  }
}

function clearAuth() {
  localStorage.removeItem('user');
  localStorage.removeItem('session_id');
  forgetCsrfToken();
  window.dispatchEvent(new Event('auth-logout'));
}

/**
 * Drop the cached CSRF token.
 *
 * The cache outlives a session, and the next account in the same tab must not
 * inherit it: a token issued to the previous session is at best useless and at
 * worst costs every write one rejected request until the `csrf_failed` retry
 * recovers. Callers are logout and the session-clearing paths.
 */
export function forgetCsrfToken(): void {
  csrfTokenCache = null;
  csrfTokenPromise = null;
}

/** Whether this browser still considers itself signed in. */
function hasLocalSession(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('user') !== null ||
    document.cookie.split('; ').some((cookie) => cookie.startsWith('user='))
  );
}

// ── Initial session priming ─────────────────────────────────
// AuthProvider refreshes the access token on mount, but React runs the effects
// of its children first: every widget fired its requests while the access token
// (30 min) was still the expired one, so a page load after a break produced a
// burst of 401s before the refresh landed. The first authenticated request of a
// page load now waits for that same single-flight refresh, so the burst becomes
// one refresh followed by healthy requests. Shared with AuthProvider's own call
// (no extra network round-trip).
let sessionPrimePromise: Promise<{ success: boolean; isUnauthenticated: boolean }> | null = null;

function primeSession(): Promise<{ success: boolean; isUnauthenticated: boolean }> {
  if (sessionPrimePromise) return sessionPrimePromise;

  const primed = refreshSessionToken();
  sessionPrimePromise = primed;

  // Only a *successful* prime is worth remembering. Remembering a failed one
  // would outlive the reason it failed: after a transient server error the user
  // could stay stuck on synthetic 401s, and after a revoked session every
  // request would keep answering 401 even once the user signed in again in the
  // same tab (login is a client-side navigation, so this module state survives
  // it) — until a full page reload. A later request simply primes again.
  const forgetIfFailed = (result: { success: boolean }) => {
    if (sessionPrimePromise === primed && !result.success) {
      sessionPrimePromise = null;
    }
  };
  primed.then(forgetIfFailed, () => {
    if (sessionPrimePromise === primed) sessionPrimePromise = null;
  });

  return primed;
}

/**
 * Proactively refresh the access token (single-flight — concurrent callers
 * share one refresh request). Call this BEFORE endpoints that would otherwise
 * 401 on an expired access token, so the browser console stays clean.
 *
 * Returns the raw refresh result: `success` and `isUnauthenticated`
 * (true = backend confirmed the refresh token is expired/invalid/revoked;
 * false = transient failure such as network error or server cold-start).
 */
export async function refreshSessionToken(): Promise<{
  success: boolean;
  isUnauthenticated: boolean;
}> {
  if (!isRefreshing || !refreshPromise) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  const result = await refreshPromise;
  return {
    success: result?.success ?? false,
    isUnauthenticated: result?.isUnauthenticated ?? false,
  };
}

const REQUEST_TIMEOUT_MS = 45000;

/**
 * One request attempt, bounded by the cold-start timeout *and* by the caller's
 * own `AbortSignal`.
 *
 * Retries used to reassign `fetchOptions.signal` to a fresh controller, which
 * replaced the caller's signal: a widget that aborted on unmount could not stop
 * the retry, and when a caller passed a signal the 45s timeout did nothing at
 * all because the timeout controller was never attached.
 */
async function requestWithTimeout(
  url: string,
  init: RequestInit,
  callerSignal: AbortSignal | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', forwardAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * Drop-in replacement for `fetch()` that:
 * 1. Automatically includes cookies with credentials: 'include'
 * 2. Attaches the X-CSRF-Token header on mutating requests (double-submit cookie)
 * 3. Refreshes an expired access token before the first request of a page load
 * 4. On 401, tries to refresh the token and retries once
 * 5. On 403 `csrf_failed`, refreshes the CSRF token and retries once
 * 6. If refresh also fails with 401, clears auth state
 */
export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  // Enforce credentials: 'include' to pass HTTP-only cookies
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };

  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  fetchOptions.headers = headers;

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);

  if (isMutating && !headers.has(CSRF_HEADER)) {
    const token = await getCsrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }

  // Refresh an expired access token before the first authenticated request of
  // a page load, instead of letting it 401 first (see `primeSession`). This
  // runs before the request timeout below starts counting.
  const primed = hasLocalSession() ? await primeSession() : null;
  if (primed?.isUnauthenticated) {
    // The refresh token itself is expired/revoked, so the API can only answer
    // 401. Clear the stale session and reply the same way without spending a
    // request (and without another red line in the console).
    clearAuth();
    // Same shape as the backend's own 401 (`{"detail": ...}`), so callers that
    // parse the body (`fetchWithAuthJson`, error toasts) behave identically for
    // this locally-minted rejection and a real one.
    return new Response(JSON.stringify({ detail: 'Session expired' }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The caller's signal (widget unmount, navigation away) has to survive every
  // attempt: see `requestWithTimeout`.
  const callerSignal = fetchOptions.signal ?? undefined;

  try {
    let response = await requestWithTimeout(`${API_URL}${path}`, fetchOptions, callerSignal);

    // ── Auto-refresh on 401 ──────────────────────────────────
    if (response.status === 401) {
      // Skip refresh entirely when there is no local session — avoids the
      // /api/v1/auth/refresh call firing on public pages like /login.
      if (!hasLocalSession()) {
        return response;
      }

      if (!isRefreshing || !refreshPromise) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }

      const refreshResult = await refreshPromise;

      if (refreshResult?.success) {
        // Retry the original request (cookies are automatically attached)
        response = await requestWithTimeout(`${API_URL}${path}`, fetchOptions, callerSignal);
      } else if (refreshResult?.isUnauthenticated) {
        // ONLY clear auth if backend confirmed the refresh token is genuinely expired/invalid
        clearAuth();
      }
    }

    // ── Retry once when the CSRF token was missing/stale ─────
    if (isMutating && response.status === 403) {
      let csrfFailed = false;
      try {
        const body = await response.clone().json();
        csrfFailed = body?.code === 'csrf_failed';
      } catch {
        // Non-JSON error body — nothing to recover from here.
      }

      if (csrfFailed) {
        csrfTokenCache = null;
        // Reuse the local cookie only when it belongs to the API origin; across
        // origins the value the API just issued for this request is the only
        // one it will accept.
        const freshToken = API_IS_CROSS_ORIGIN
          ? await requestCsrfToken()
          : (readCsrfCookie() ?? (await requestCsrfToken()));
        if (freshToken) {
          csrfTokenCache = freshToken;
          headers.set(CSRF_HEADER, freshToken);
          response = await requestWithTimeout(`${API_URL}${path}`, fetchOptions, callerSignal);
        }
      }
    }

    return response;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      // Tell the two aborts apart: our own 45s timeout, and the caller walking
      // away (unmount/navigation). Reporting an unmount as "Request timeout"
      // surfaced timeout errors for pages the user had already left.
      if (callerSignal?.aborted) throw error;
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Like fetchWithAuth but also:
 *   1. parses response JSON,
 *   2. validates it against the given Zod schema,
 *   3. returns the typed result.
 *
 * Usage:
 *   const data = await fetchWithAuthJson('/api/v1/profile/me', {}, AuthUserSchema);
 *   //   👆 typed as AuthUserParsed — no more `any`!
 *
 * If you don't pass a schema it falls back to `ResponseModelSchema` (the default
 * {result, message, data} envelope).
 */
export async function fetchWithAuthJson(
  path: string,
  options?: RequestInit,
): Promise<ResponseModelParsed>;
export async function fetchWithAuthJson<T extends z.ZodTypeAny>(
  path: string,
  options: RequestInit,
  schema: T,
): Promise<z.infer<T>>;
// Zod 4 types `z.infer<T>` as a mapped `output<T>`, which TypeScript cannot
// prove assignable to a deferred conditional return type, so the two call
// shapes above are expressed as overloads instead.
export async function fetchWithAuthJson<T extends z.ZodTypeAny>(
  path: string,
  options: RequestInit = {},
  schema?: T,
): Promise<ResponseModelParsed | z.infer<T>> {
  const res = await fetchWithAuth(path, options);
  if (!res.ok) {
    // Read the error body without letting the read itself decide the result:
    // the previous version built the rich error *and threw it from inside* this
    // `try`, so the `catch` below swallowed it and replaced it with a bare Error.
    // Every caller checking `error.status` (AuthProvider's 401 handling,
    // QuickNotesWidget's message) therefore saw `undefined`.
    let errData: { message?: string; detail?: string } | undefined;
    try {
      errData = await res.json();
    } catch {
      errData = undefined;
    }
    const msg = errData?.message || errData?.detail || res.statusText;
    const error = new Error(`Request failed: ${res.status} ${msg}`) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = res.status;
    error.data = errData;
    throw error;
  }
  return parseJsonWithSchema(res, (schema || (await import('./schemas')).ResponseModelSchema) as T);
}
