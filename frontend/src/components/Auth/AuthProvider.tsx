'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'

export type AuthRole = 'admin' | 'user' | string

export interface AuthUser {
  id: number
  email: string
  name: string
  role: AuthRole
  avatar?: string | null
  quick_links?: string | null
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  isAuthenticated: boolean
  user: AuthUser | null
  accessToken: string | null
  login: (accessToken: string, user: AuthUser, refreshToken?: string, sessionId?: string) => void
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

function readAuthFromStorage() {
  if (typeof window === 'undefined') {
    return { accessToken: null as string | null, user: null as AuthUser | null }
  }

  const accessToken = localStorage.getItem('access_token')
  const user = safeParseUser(localStorage.getItem('user'))
  return { accessToken, user }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  const syncFromStorage = useCallback(() => {
    const { accessToken: token, user: u } = readAuthFromStorage()
    setAccessToken(token)
    setUser(u)
    setStatus(token && u ? 'authenticated' : 'anonymous')
  }, [])

  useEffect(() => {
    syncFromStorage()

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (['access_token', 'user', 'refresh_token', 'session_id'].includes(e.key)) {
        syncFromStorage()
      }
    }

    const onLogout = () => syncFromStorage()
    const onUserProfileUpdated = () => syncFromStorage()

    window.addEventListener('storage', onStorage)
    window.addEventListener('auth-logout', onLogout)
    window.addEventListener('auth-login', syncFromStorage)
    window.addEventListener('user-profile-updated', onUserProfileUpdated)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('auth-logout', onLogout)
      window.removeEventListener('auth-login', syncFromStorage)
      window.removeEventListener('user-profile-updated', onUserProfileUpdated)
    }
  }, [syncFromStorage])

  // Sync ข้อมูลโปรไฟล์เพิ่มเติม (เช่น quick_links) จาก backend เมื่อเข้าสู่ระบบ
  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetchWithAuth('/api/v1/profile/me')

        if (!res.ok) return

        const profile = (await res.json()) as Partial<AuthUser> & { quick_links?: string | null }
        if (cancelled) return

        setUser((prev) => {
          if (!prev) return prev
          const merged: AuthUser = { ...prev, ...profile }
          localStorage.setItem('user', JSON.stringify(merged))
          return merged
        })
      } catch {
        // ไม่บังคับสำเร็จ (fallback ใช้ข้อมูลเดิมจาก localStorage)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, accessToken])

  const login = useCallback(
    (token: string, nextUser: AuthUser, refreshToken?: string, sessionId?: string) => {
      localStorage.setItem('access_token', token)
      localStorage.setItem('user', JSON.stringify(nextUser))
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
      if (sessionId) localStorage.setItem('session_id', sessionId)

      setAccessToken(token)
      setUser(nextUser)
      setStatus('authenticated')
      window.dispatchEvent(new Event('auth-login'))
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('session_id')
    localStorage.removeItem('user')

    setAccessToken(null)
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
      accessToken,
      login,
      logout,
      updateUser,
    }),
    [status, user, accessToken, login, logout, updateUser]
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
