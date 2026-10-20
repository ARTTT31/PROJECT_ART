'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type AuthRole } from '@/hooks/useAuth'

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
      // Remember where the visitor was headed. The admin approval alert email
      // links straight to /profile?tab=admin, so dropping the deep link at the
      // sign-in wall would leave the new request invisible after login.
      const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const separator = redirectTo.includes('?') ? '&' : '?'
      router.replace(`${redirectTo}${separator}next=${encodeURIComponent(next)}`)
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

