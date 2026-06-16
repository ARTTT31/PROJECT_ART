/**
 * Authenticated fetch helper with automatic cookie-based session/token refresh.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://art-workspace-api.onrender.com';

// ── Shared refresh state ─────────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data?.result === 'success') {
      window.dispatchEvent(new Event('auth-login'));
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function clearAuth() {
  localStorage.removeItem('user');
  localStorage.removeItem('session_id');
  window.dispatchEvent(new Event('auth-logout'));
}

/**
 * Drop-in replacement for `fetch()` that:
 * 1. Automatically includes cookies with credentials: 'include'
 * 2. On 401, tries to refresh the token and retries once
 * 3. If refresh also fails, clears auth state and redirects/rejects
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
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

  let response = await fetch(`${API_URL}${path}`, fetchOptions);

  // ── Auto-refresh on 401 ──────────────────────────────────
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
      });
    }

    const success = await refreshPromise;

    if (success) {
      // Retry the original request (cookies are automatically attached)
      response = await fetch(`${API_URL}${path}`, fetchOptions);
    } else {
      clearAuth();
    }
  }

  return response;
}

