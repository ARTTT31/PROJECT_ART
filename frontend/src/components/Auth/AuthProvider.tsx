'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth, fetchWithAuthJson, refreshSessionToken } from '@/lib/api/fetchWithAuth';
import { AuthUserSchema } from '@/lib/api/schemas';
import { readUserCookie } from '@/lib/api/userCookie';
import type { AuthUser, AuthRole } from '@/types';
import { ZodError } from 'zod';

export type { AuthUser, AuthRole };

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (user: AuthUser, sessionId?: string) => void;
  logout: () => void;
  updateUser: (next: Partial<AuthUser>) => void;
  /** Check if session is still valid - returns false if 401 */
  validateSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Parse raw JSON user string and validate with Zod runtime schema.
 * Falls back to null on parse failure (instead of silently returning `any`).
 */
function safeParseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = AuthUserSchema.safeParse(parsed);
    if (result.success) return result.data;
    if (typeof window !== 'undefined') {
      console.warn('[AUTH] localStorage user failed Zod validation:', result.error.message);
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // ── Validate session helper ──
  // Refresh the token first so an expired access token doesn't 401 (and thus
  // log 'Failed to load resource' noise in the browser console).
  const validateSession = useCallback(async (): Promise<boolean> => {
    const refreshResult = await refreshSessionToken();
    if (!refreshResult.success && refreshResult.isUnauthenticated) return false;
    if (!refreshResult.success) return true; // transient failure — keep session
    try {
      // /profile/me already carries every field AuthUserSchema needs, so it is
      // the single session probe. Calling both it and /auth/session doubled the
      // backend + database work on every mount for the same user.
      const user = await fetchWithAuthJson('/api/v1/profile/me', {}, AuthUserSchema);
      if (user) return true;
      return true;
    } catch (err) {
      if (err instanceof Error) {
        const anyErr = err as Error & { status?: number };
        if (anyErr.status === 401 || anyErr.status === 403) return false;
        if (err instanceof ZodError) {
          // Schema mismatch — session data shape is unexpected but server returned 2xx,
          // keep session alive rather than logging the user out.
          console.warn('[AUTH] Session envelope Zod mismatch (server version drift?)');
          return true;
        }
      }
      // Network error / timeout — treat as valid to not punish cold-starts
      return true;
    }
  }, []);

  // ── Centralized 401 handler ──
  useEffect(() => {
    const handle401 = () => {
      setUser(null);
      setStatus('anonymous');
      localStorage.removeItem('user');
      localStorage.removeItem('session_id');
      // Use router.replace for smooth navigation
      router.replace('/login');
    };

    window.addEventListener('auth-logout', handle401);
    return () => window.removeEventListener('auth-logout', handle401);
  }, [router]);

  // 1. Session check on mount — fast-path from localStorage, background verify
  useEffect(() => {
    const initializeAuth = async () => {
      // ── Fast-path: use localStorage/cookie for instant display ──
      let localUser = safeParseUser(localStorage.getItem('user'));

      // The cookie wins when present: login/refresh just wrote it, while
      // localStorage can hold a stale copy. Validate it like localStorage data —
      // the cookie is client-readable, so never trust its shape.
      const cookieUser = readUserCookie();
      if (cookieUser) {
        const parsedCookie = AuthUserSchema.safeParse(cookieUser);
        if (parsedCookie.success) localUser = parsedCookie.data;
      }

      if (localUser) {
        setUser(localUser);
        setStatus('authenticated');
      }

      // ── Background verify: only run if we have a local user/cookie to validate ──
      // Skip entirely on public pages like /login where no session exists yet.
      if (!localUser) {
        setStatus('anonymous');
        return;
      }

      try {
        // Refresh the access token first, so the verification calls below don't
        // start with a guaranteed 401 when the token has expired (keeps the
        // browser console free of 'Failed to load resource: 401' noise).
        const refreshResult = await refreshSessionToken();
        if (!refreshResult.success && refreshResult.isUnauthenticated) {
          // Backend rejected the refresh token — session is genuinely invalid.
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('session_id');
          setStatus('anonymous');
          return;
        }

        // One authenticated profile read is enough to verify the session and
        // hydrate the user. It returns the user object directly, not the
        // standard envelope.
        const profileJson = await fetchWithAuthJson(
          '/api/v1/profile/me',
          {},
          AuthUserSchema,
        );
        const parsedProfile = AuthUserSchema.safeParse(profileJson);

        if (parsedProfile.success) {
          setUser(parsedProfile.data);
          localStorage.setItem('user', JSON.stringify(parsedProfile.data));
          setStatus('authenticated');
        } else if (!localUser) {
          // Network errors / schema parse failures should NOT log out a locally
          // authenticated user; only clear when there was no cached user.
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('session_id');
          setStatus('anonymous');
        }
      } catch (e) {
        // Explicit 401 from backend (refresh token invalid / session revoked) → clear auth regardless of local state
        // Any other error (network / timeout / 5xx cold-start) → only clear if no local user cached
        const status = (e as Error & { status?: number })?.status;
        if (status === 401 || !localUser) {
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('session_id');
          setStatus('anonymous');
        }
      }
    };

    initializeAuth();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (['user', 'session_id'].includes(e.key)) {
        const u = safeParseUser(localStorage.getItem('user'));
        setUser(u);
        setStatus(u ? 'authenticated' : 'anonymous');
      }
    };

    const onLogout = () => {
      setUser(null);
      setStatus('anonymous');
    };

    const onLogin = () => {
      const u = safeParseUser(localStorage.getItem('user'));
      setUser(u);
      setStatus(u ? 'authenticated' : 'anonymous');
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('auth-logout', onLogout);
    window.addEventListener('auth-login', onLogin);

    // ── Proactive Keep-Alive: Refresh token + verify session every 15 mins ──
    const keepAliveInterval = setInterval(
      async () => {
        const u = safeParseUser(localStorage.getItem('user'));
        if (!u) return;
        try {
          // Refresh first so the keep-alive session ping doesn't log a 401 in
          // the browser console when the access token has expired.
          const refreshResult = await refreshSessionToken();
          if (!refreshResult.success && refreshResult.isUnauthenticated) {
            window.dispatchEvent(new Event('auth-logout'));
            return;
          }
          await fetchWithAuth('/api/v1/profile/me');
        } catch (e) {
          console.warn('Background session keep-alive ping:', e);
        }
      },
      15 * 60 * 1000,
    );

    // ── Tab re-focus / visibility change handler ──
    const onVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const u = safeParseUser(localStorage.getItem('user'));
        if (u) {
          try {
            // Same as keep-alive: refresh before the session ping so an expired
            // token doesn't surface a 401 in the browser console.
            const refreshResult = await refreshSessionToken();
            if (!refreshResult.success && refreshResult.isUnauthenticated) {
              window.dispatchEvent(new Event('auth-logout'));
              return;
            }
            await fetchWithAuth('/api/v1/profile/me');
          } catch (e) {
            console.warn('Visibility session check:', e);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      clearInterval(keepAliveInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth-logout', onLogout);
      window.removeEventListener('auth-login', onLogin);
    };
  }, []);

  const login = useCallback((nextUser: AuthUser, sessionId?: string) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    if (sessionId) localStorage.setItem('session_id', sessionId);

    setUser(nextUser);
    setStatus('authenticated');
    window.dispatchEvent(new Event('auth-login'));
  }, []);

  const logout = useCallback(async () => {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('session_id') : null;

    // 1. Immediately wipe local state & cookies for instant UI response
    try {
      localStorage.removeItem('session_id');
      localStorage.removeItem('user');
      document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
      document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
    } catch {}

    setUser(null);
    setStatus('anonymous');
    window.dispatchEvent(new Event('auth-logout'));

    // T11: purge Cache Storage after logout so no cached (session-scoped)
    // response survives for the next signed-in account.
    try {
      const { clearServiceWorkerCaches } = await import('@/utils/swCacheRules');
      await clearServiceWorkerCaches();
    } catch (e) {
      console.warn('Logout cache purge:', e);
    }

    // 2. Notify backend in background to invalidate session & clear httpOnly cookies
    try {
      await fetchWithAuth(`/api/v1/auth/logout${sessionId ? `?session_id=${sessionId}` : ''}`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (e) {
      console.warn('Backend logout notification:', e);
    }
  }, []);

  const updateUser = useCallback((next: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...next };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user,
      login,
      logout,
      updateUser,
      validateSession,
    }),
    [status, user, login, logout, updateUser, validateSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth ต้องถูกเรียกภายใน <AuthProvider>');
  }
  return ctx;
}
