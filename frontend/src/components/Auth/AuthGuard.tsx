'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type AuthRole } from './AuthProvider'

export default function AuthGuard({
  children,
  requireRole,
  redirectTo = '/login',
}: {
  children: React.ReactNode
  requireRole?: AuthRole
  redirectTo?: string
}) {
  const router = useRouter()
  const { status, user, isAuthenticated } = useAuth()

  useEffect(() => {
    if (status === 'loading') return
    if (!isAuthenticated) {
      router.replace(redirectTo)
      return
    }

    if (requireRole && user?.role !== requireRole) {
      router.replace('/dashboard')
    }
  }, [status, isAuthenticated, requireRole, user?.role, router, redirectTo])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-500" aria-label="กำลังโหลด" />
      </div>
    )
  }

  if (!isAuthenticated) return null
  if (requireRole && user?.role !== requireRole) return null

  return children
}

