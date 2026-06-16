import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://art-workspace-api.onrender.com';
const baseURL = `${API_URL}/api/v1`;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Auto-refresh logic (Cookie-based) ─────────────────────────
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

function onTokenRefreshed() {
  pendingRequests.forEach((cb) => cb());
  pendingRequests = [];
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    // Send request with credentials so the refresh_token cookie is attached
    const response = await axios.post(`${baseURL}/auth/refresh`, {}, {
      withCredentials: true,
    });

    if (response.data?.result === 'success') {
      // Notify other parts of the app to sync user state if needed
      window.dispatchEvent(new Event('auth-login'));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Response interceptor for error handling + auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const success = await refreshAccessToken();

          if (success) {
            onTokenRefreshed();
            // Retry the original request (which will now automatically send the new cookie)
            return apiClient(originalRequest);
          } else {
            // Refresh failed — force logout on the frontend
            localStorage.removeItem('user');
            localStorage.removeItem('session_id');
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('auth-logout'));
            }
            return Promise.reject(error);
          }
        } finally {
          isRefreshing = false;
        }
      }

      // If another request is already refreshing, queue this one
      return new Promise((resolve) => {
        pendingRequests.push(() => {
          resolve(apiClient(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

