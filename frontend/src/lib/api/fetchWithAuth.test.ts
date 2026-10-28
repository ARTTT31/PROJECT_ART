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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearCookie('csrf_token');
});

describe('fetchWithAuth CSRF token source', () => {
  it('prefers the token issued by the API over a stale cookie on this origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
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
});
