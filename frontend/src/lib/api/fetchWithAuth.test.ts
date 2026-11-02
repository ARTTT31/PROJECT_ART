import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The CSRF token must come from the origin that will validate it.
 *
 * Production served the frontend from Vercel but called the API on Render.
 * A `csrf_token` left behind on the Vercel origin by an earlier same-origin
 * deployment was preferred over the token the API issued, so every write was
 * rejected with `csrf_failed` and the retry kept re-reading the stale value.
 */

const CSRF_ENDPOINT = '/api/v1/auth/csrf';

interface Call {
  url: string;
  init?: RequestInit;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetch(handler: (url: string) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url, init });
      return handler(url);
    }),
  );
  return calls;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function csrfHeaderOf(call: Call | undefined): string | null {
  expect(call).toBeDefined();
  return new Headers(call!.init?.headers).get('X-CSRF-Token');
}

beforeEach(() => {
  vi.resetModules();
  clearCookie('csrf_token');
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearCookie('csrf_token');
  localStorage.clear();
});

describe('fetchWithAuth CSRF token source', () => {
  it('prefers the token issued by the API over a stale cookie on this origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('NEXT_PUBLIC_USE_SAME_ORIGIN_API', 'false');
    setCookie('csrf_token', 'stale-local');
    const calls = installFetch((url) =>
      url.endsWith(CSRF_ENDPOINT)
        ? jsonResponse({ result: 'success', data: { csrf_token: 'api-issued' } })
        : jsonResponse({ result: 'success', data: {} }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');
    await fetchWithAuth('/api/v1/system/branding', { method: 'PUT', body: '{}' });

    const put = calls.find((call) => call.init?.method === 'PUT');
    expect(csrfHeaderOf(put)).toBe('api-issued');
    expect(calls.some((call) => call.url === `https://api.example.com${CSRF_ENDPOINT}`)).toBe(true);
  });

  it('uses the cookie this origin owns when the API is same-origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    setCookie('csrf_token', 'same-origin-token');
    const calls = installFetch(() => jsonResponse({ result: 'success', data: {} }));

    const { fetchWithAuth } = await import('./fetchWithAuth');
    await fetchWithAuth('/api/v1/system/branding', { method: 'PUT', body: '{}' });

    expect(csrfHeaderOf(calls.find((call) => call.init?.method === 'PUT'))).toBe(
      'same-origin-token',
    );
    expect(calls.some((call) => call.url.includes(CSRF_ENDPOINT))).toBe(false);
  });

  it('ignores a configured API origin unless direct-API mode is explicit', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    setCookie('csrf_token', 'same-origin-token');
    const calls = installFetch(() => jsonResponse({ result: 'success', data: {} }));

    const { fetchWithAuth } = await import('./fetchWithAuth');
    await fetchWithAuth('/api/v1/system/branding', { method: 'PUT', body: '{}' });

    expect(csrfHeaderOf(calls.find((call) => call.init?.method === 'PUT'))).toBe(
      'same-origin-token',
    );
    expect(calls.some((call) => call.url.startsWith('https://api.example.com'))).toBe(false);
  });
});

/**
 * A page loaded after the 30-minute access token expired used to fire every
 * widget request with the stale cookie, because React runs the children's
 * effects before AuthProvider's refresh. Each of those logged a 401.
 */
describe('fetchWithAuth session priming', () => {
  it('refreshes the access token before the first request of a page load', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    const calls = installFetch((url) =>
      url.endsWith('/api/v1/auth/refresh')
        ? jsonResponse({ result: 'success', data: {} })
        : jsonResponse({ result: 'success', data: {} }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');
    await fetchWithAuth('/api/v1/profile/finance');

    expect(calls.map((call) => call.url)).toEqual([
      '/api/v1/auth/refresh',
      '/api/v1/profile/finance',
    ]);
  });

  it('shares one refresh across concurrent requests', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    const calls = installFetch((url) =>
      url.endsWith('/api/v1/auth/refresh')
        ? jsonResponse({ result: 'success', data: {} })
        : jsonResponse({ result: 'success', data: {} }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');
    await Promise.all([
      fetchWithAuth('/api/v1/profile/finance'),
      fetchWithAuth('/api/v1/weather/air-quality'),
      fetchWithAuth('/api/v1/users/pending'),
    ]);

    expect(calls.filter((call) => call.url.endsWith('/api/v1/auth/refresh'))).toHaveLength(1);
  });

  it('answers 401 without calling the API when the refresh token is dead', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    const calls = installFetch((url) =>
      url.endsWith('/api/v1/auth/refresh')
        ? jsonResponse({ detail: 'Session revoked' }, 401)
        : jsonResponse({ result: 'success', data: {} }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');
    const response = await fetchWithAuth('/api/v1/profile/finance');

    expect(response.status).toBe(401);
    expect(calls.map((call) => call.url)).toEqual(['/api/v1/auth/refresh']);
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('does not refresh when there is no local session', async () => {
    const calls = installFetch(() => jsonResponse({ result: 'success', data: {} }));

    const { fetchWithAuth } = await import('./fetchWithAuth');
    await fetchWithAuth('/api/v1/system/branding');

    expect(calls.map((call) => call.url)).toEqual(['/api/v1/system/branding']);
  });

  /**
   * The prime result is module state and login is a client-side navigation, so
   * a failed prime must not be cached for the rest of the page's life: the user
   * would sign in again and every request would still be answered with a
   * synthetic 401 until a full reload.
   */
  it('primes again after a failed prime instead of latching the 401', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    let refreshCalls = 0;
    const calls = installFetch((url) => {
      if (!url.endsWith('/api/v1/auth/refresh')) return jsonResponse({ result: 'success', data: {} });
      refreshCalls += 1;
      // First prime: the session was revoked. Second: the user logged in again.
      return refreshCalls === 1
        ? jsonResponse({ detail: 'Session revoked' }, 401)
        : jsonResponse({ result: 'success', data: {} });
    });

    const { fetchWithAuth } = await import('./fetchWithAuth');

    const first = await fetchWithAuth('/api/v1/profile/finance');
    expect(first.status).toBe(401);
    expect(localStorage.getItem('user')).toBeNull();

    // The login page wrote the session back; no reload happens in between.
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    const second = await fetchWithAuth('/api/v1/profile/finance');

    expect(second.status).toBe(200);
    expect(calls.map((call) => call.url)).toEqual([
      '/api/v1/auth/refresh',
      '/api/v1/auth/refresh',
      '/api/v1/profile/finance',
    ]);
  });
});

/**
 * Callers decide what to do from the HTTP status (AuthProvider clears the
 * session on 401, widgets show a specific message per status). Building the
 * error and throwing it from inside the `try` that guards the body read made
 * the catch swallow it, so `status` was always undefined.
 */
describe('fetchWithAuthJson error details', () => {
  it('keeps the status and the parsed body on the thrown error', async () => {
    installFetch(() => jsonResponse({ message: 'boom' }, 404));

    const { fetchWithAuthJson } = await import('./fetchWithAuth');

    await expect(fetchWithAuthJson('/api/v1/profile/finance')).rejects.toMatchObject({
      status: 404,
      data: { message: 'boom' },
      message: 'Request failed: 404 boom',
    });
  });

  it('keeps the status when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>gateway</html>', { status: 502 })),
    );

    const { fetchWithAuthJson } = await import('./fetchWithAuth');

    await expect(fetchWithAuthJson('/api/v1/profile/finance')).rejects.toMatchObject({
      status: 502,
    });
  });
});

/**
 * A request that is retried after a refresh (or a CSRF retry) must stay under
 * the caller's control: reassigning `signal` per attempt detached it, so a
 * widget that aborted on unmount let the retry run on, and a caller-supplied
 * signal made the 45s timeout inert.
 */
describe('fetchWithAuth abort handling', () => {
  it('keeps the caller signal attached to the retry attempt', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    const caller = new AbortController();
    const signals: AbortSignal[] = [];
    let resolveRetry: ((response: Response) => void) | undefined;
    let apiCalls = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/v1/auth/refresh')) {
          return jsonResponse({ result: 'success', data: {} });
        }
        apiCalls += 1;
        if (init?.signal) signals.push(init.signal);
        if (apiCalls === 1) return jsonResponse({ detail: 'expired' }, 401);
        // Hold the retry open so the caller can abort while it is in flight.
        return new Promise<Response>((resolve) => {
          resolveRetry = resolve;
        });
      }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');
    const pending = fetchWithAuth('/api/v1/profile/finance', { signal: caller.signal });

    await vi.waitFor(() => expect(apiCalls).toBe(2));
    caller.abort();
    expect(signals[1]?.aborted).toBe(true);

    resolveRetry?.(jsonResponse({ result: 'success', data: {} }));
    await expect(pending).resolves.toMatchObject({ status: 200 });
  });

  it('reports a caller abort as an abort, not as our own timeout', async () => {
    const caller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        caller.abort();
        throw new DOMException('Aborted', 'AbortError');
      }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');

    await expect(fetchWithAuth('/api/v1/system/branding', { signal: caller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('fetchWithAuth synthetic session expiry', () => {
  it('answers a JSON body so callers can parse it like a real 401', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'tester' }));
    installFetch((url) =>
      url.endsWith('/api/v1/auth/refresh')
        ? jsonResponse({ detail: 'Session revoked' }, 401)
        : jsonResponse({ result: 'success', data: {} }),
    );

    const { fetchWithAuth } = await import('./fetchWithAuth');
    const response = await fetchWithAuth('/api/v1/profile/finance');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ detail: 'Session expired' });
  });

  it('drops the cached CSRF token once the session ends', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('NEXT_PUBLIC_USE_SAME_ORIGIN_API', 'false');
    const calls = installFetch((url) =>
      url.endsWith(CSRF_ENDPOINT)
        ? jsonResponse({ result: 'success', data: { csrf_token: `issued-${Date.now()}` } })
        : jsonResponse({ result: 'success', data: {} }),
    );

    const { fetchWithAuth, forgetCsrfToken } = await import('./fetchWithAuth');
    await fetchWithAuth('/api/v1/system/branding', { method: 'PUT', body: '{}' });
    expect(calls.filter((call) => call.url.endsWith(CSRF_ENDPOINT))).toHaveLength(1);

    // Logout in this tab: the next account must not inherit the old token.
    forgetCsrfToken();
    const labeled = calls.length;
    await fetchWithAuth('/api/v1/system/branding', { method: 'PUT', body: '{}' });

    expect(calls.slice(labeled).map((call) => call.url)).toEqual([
      `https://api.example.com${CSRF_ENDPOINT}`,
      'https://api.example.com/api/v1/system/branding',
    ]);
  });
});
