/**
 * Authenticated fetch helper with automatic token refresh.
 *
 * All pages that call the API with raw `fetch()` should use this instead,
 * so they benefit from the auto-refresh logic (access tokens expire in 30 min).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Shared refresh state ─────────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.result === 'success' && data?.data?.access_token) {
      const newToken = data.data.access_token;
      localStorage.setItem('access_token', newToken);

      if (data.data.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }

      window.dispatchEvent(new Event('auth-login'));
      return newToken;
    }

    return null;
  } catch {
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  // We can't easily check expiry from outside, so we just return the token.
  // If it's expired, the 401 handler below will refresh it.
  return token;
}

function clearAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('session_id');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth-logout'));
}

/**
 * Drop-in replacement for `fetch()` that:
 * 1. Automatically adds the `Authorization` header
 * 2. On 401, tries to refresh the token and retries once
 * 3. If refresh also fails, clears auth and rejects
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getValidToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${API_URL}${path}`, { ...options, headers });

  // ── Auto-refresh on 401 ──────────────────────────────────
  if (response.status === 401 && token) {
    // Only try refresh once per expiry window
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      // Retry the original request with the new token
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      if (!retryHeaders.has('Content-Type') && options.body && typeof options.body === 'string') {
        retryHeaders.set('Content-Type', 'application/json');
      }

      response = await fetch(`${API_URL}${path}`, { ...options, headers: retryHeaders });
    } else {
      clearAuth();
    }
  }

  return response;
}
