'use client'

import { memo, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Clock, Menu } from 'lucide-react'
import { AuthUser } from '@/types'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  user?: AuthUser | null
  onMenuClick: () => void
  onLogout?: () => void
  sidebarCollapsed?: boolean
}

export default function Header({ user, onMenuClick, sidebarCollapsed = false }: HeaderProps) {
  const pathname = usePathname()

  const headerMeta = (() => {
    if (pathname.startsWith('/camera')) {
      return {
        title: 'กล้องวงจรปิด',
        crumbs: [
          { label: 'หน้าหลัก', href: '/dashboard' },
          { label: 'กล้องวงจรปิด' },
        ],
      }
    }

    if (pathname.startsWith('/profile')) {
      return {
        title: 'โปรไฟล์',
        crumbs: [
          { label: 'หน้าหลัก', href: '/dashboard' },
          { label: 'โปรไฟล์' },
        ],
      }
    }

    // default: dashboard
    return {
      title: 'แดชบอร์ด',
      crumbs: [{ label: 'หน้าหลัก' }, { label: 'แดชบอร์ด' }],
    }
  })()

  const displayName = user?.display_name || user?.name || user?.username || 'ผู้ใช้งาน'
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'
  const roleLabel = user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'

  return (
    <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-[rgba(255,255,255,0.82)] backdrop-blur-2xl transition-all">
      <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">
        {/* Left Side: Sidebar Toggle & Page Title/Breadcrumb */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#1d1d1f] transition-all duration-150 hover:bg-black/[0.05] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            aria-label={sidebarCollapsed ? 'เปิดแถบเมนูด้านข้าง' : 'พับแถบเมนูด้านข้าง'}
            aria-pressed={!sidebarCollapsed}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-[#1d1d1f]">
              {headerMeta.title}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <nav
                aria-label="breadcrumb"
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#86868b]"
              >
                {headerMeta.crumbs.map((c, idx) => {
                  const isLast = idx === headerMeta.crumbs.length - 1
                  return (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-1.5">
                      {c.href ? (
                        <Link
                          href={c.href}
                          className="transition-colors hover:text-[#1d1d1f]"
                        >
                          {c.label}
                        </Link>
                      ) : (
                        <span className={isLast ? 'text-[#1d1d1f]' : ''}>
                          {c.label}
                        </span>
                      )}
                      {!isLast && <span aria-hidden="true" className="text-black/20">/</span>}
                    </span>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Right Side: Clock, Notification Bell & User Profile Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden min-h-[36px] items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 px-3.5 py-1.5 text-[12px] font-semibold text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:flex">
            <ClockTime />
          </div>

          <NotificationBell />

          {/* User Profile Pill */}
          {user && (
            <Link
              href="/profile"
              className="group flex items-center gap-2.5 rounded-full border border-black/[0.06] bg-white/90 py-1 pl-1 pr-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:bg-white hover:shadow-md active:scale-[0.98]"
              aria-label={`โปรไฟล์ของ ${displayName}`}
            >
              {user.avatar || user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar || user.avatar_url || ''}
                  alt={displayName}
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-black/[0.08]"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-[#0071e3] to-[#42a5f5] text-[11px] font-bold text-white shadow-xs">
                  {initial}
                </div>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

/** Isolated clock component – only this subtree re-renders every minute */
const ClockTime = memo(function ClockTime() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const formatted = time.toLocaleString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34c759] opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34c759]"></span>
      </span>
      <Clock size={14} className="text-[#0071e3]" aria-hidden="true" />
      <span>{formatted}</span>
    </>
  )
})
