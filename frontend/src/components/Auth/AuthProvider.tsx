'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import type { AuthUser, AuthRole } from '@/types'

export type { AuthUser, AuthRole }

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  isAuthenticated: boolean
  user: AuthUser | null
  login: (user: AuthUser, sessionId?: string) => void
  logout: () => void
  updateUser: (next: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function safeParseUser(raw: string | null): AuthUser | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  // 1. Session check on mount — fast-path from localStorage, background verify
  useEffect(() => {
    const initializeAuth = async () => {
      // ── Fast-path: use localStorage/cookie for instant display ──
      const userCookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('user='));

      let localUser = safeParseUser(localStorage.getItem('user'));

      if (userCookie) {
        try {
          const parsedCookie = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
          localUser = parsedCookie;
        } catch (e) {}
      }

      if (localUser) {
        setUser(localUser);
        setStatus('authenticated');
      }

      // ── Background verify: run session check and profile sync in parallel ──
      try {
        const [sessionRes, profileRes] = await Promise.all([
          fetchWithAuth('/api/v1/auth/session').catch(() => null),
          fetchWithAuth('/api/v1/profile/me').catch(() => null),
        ]);

        let sessionUser = null;
        if (sessionRes && sessionRes.ok) {
          const json = await sessionRes.json();
          if (json.data && json.data.user) {
            sessionUser = json.data.user;
          }
        }

        let profileData = null;
        if (profileRes && profileRes.ok) {
          try {
            profileData = await profileRes.json();
          } catch (e) {}
        }

        if (sessionUser) {
          const mergedUser = profileData ? { ...sessionUser, ...profileData } : sessionUser;
          setUser(mergedUser);
          localStorage.setItem('user', JSON.stringify(mergedUser));
          setStatus('authenticated');
        } else {
          // Only clear auth if we got an explicit 401 AND had no local user
          // This prevents clearing auth on network errors or Render cold-start timeouts
          if ((sessionRes && sessionRes.status === 401) || !localUser) {
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('session_id');
            setStatus('anonymous');
          }
        }
      } catch (e) {
        // Network error — if we have a local user, keep them authenticated
        // (backend might be cold-starting on Render)
        if (!localUser) {
          setUser(null);
          setStatus('anonymous');
        }
      }
    };

    initializeAuth();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (['user', 'session_id'].includes(e.key)) {
        const u = safeParseUser(localStorage.getItem('user'));
        setUser(u);
        setStatus(u ? 'authenticated' : 'anonymous');
      }
    }

    const onLogout = () => {
      setUser(null);
      setStatus('anonymous');
    }

    const onLogin = () => {
      const u = safeParseUser(localStorage.getItem('user'));
      setUser(u);
      setStatus(u ? 'authenticated' : 'anonymous');
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('auth-logout', onLogout)
    window.addEventListener('auth-login', onLogin)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('auth-logout', onLogout)
      window.removeEventListener('auth-login', onLogin)
    }
  }, [])

  const login = useCallback(
    (nextUser: AuthUser, sessionId?: string) => {
      localStorage.setItem('user', JSON.stringify(nextUser))
      if (sessionId) localStorage.setItem('session_id', sessionId)

      setUser(nextUser)
      setStatus('authenticated')
      window.dispatchEvent(new Event('auth-login'))
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem('session_id')
      await fetchWithAuth('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      })
    } catch (e) {
      console.error('Logout failed:', e)
    }

    localStorage.removeItem('session_id')
    localStorage.removeItem('user')

    setUser(null)
    setStatus('anonymous')
    window.dispatchEvent(new Event('auth-logout'))
  }, [])

  const updateUser = useCallback((next: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev
      const merged = { ...prev, ...next }
      localStorage.setItem('user', JSON.stringify(merged))
      return merged
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user,
      login,
      logout,
      updateUser,
    }),
    [status, user, login, logout, updateUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth ต้องถูกเรียกภายใน <AuthProvider>')
  }
  return ctx
}

