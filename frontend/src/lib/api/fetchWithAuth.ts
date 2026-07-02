/**
 * Authenticated fetch helper with automatic cookie-based session/token refresh.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://project-art-c7eh.onrender.com';

// ── Shared refresh state ─────────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return false;

    const data = await res.json();
    if (data?.result === 'success') {
      window.dispatchEvent(new Event('auth-login'));
      return true;
    }

    return false;
  } catch {
    clearTimeout(timeoutId);
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  if (!fetchOptions.signal) {
    fetchOptions.signal = controller.signal;
  }

  try {
    let response = await fetch(`${API_URL}${path}`, fetchOptions);
    clearTimeout(timeoutId);

    // ── Auto-refresh on 401 ──────────────────────────────────
    if (response.status === 401) {
      // Skip refresh entirely when there is no local session — avoids the
      // /api/v1/auth/refresh call firing on public pages like /login.
      const hasLocalSession =
        typeof window !== 'undefined' &&
        (localStorage.getItem('user') !== null ||
          document.cookie.split('; ').some((c) => c.startsWith('user=')));

      if (!hasLocalSession) {
        return response;
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
        });
      }

      const success = await refreshPromise;

      if (success) {
        // Retry the original request (cookies are automatically attached)
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
        fetchOptions.signal = retryController.signal;
        try {
          response = await fetch(`${API_URL}${path}`, fetchOptions);
        } finally {
          clearTimeout(retryTimeoutId);
        }
      } else {
        clearAuth();
      }
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

