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

export default function Header({ onMenuClick, sidebarCollapsed = false }: HeaderProps) {
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

  return (
    <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/75 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)]">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left Side: Sidebar Toggle & Page Title/Breadcrumb */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="art-icon-button"
            aria-label={sidebarCollapsed ? 'เปิดแถบเมนูด้านข้าง' : 'พับแถบเมนูด้านข้าง'}
            aria-pressed={!sidebarCollapsed}
          >
            <Menu size={22} aria-hidden="true" />
          </button>

          <div>
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: '#1d1d1f' }}>
              {headerMeta.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <nav
                aria-label="breadcrumb"
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: '#6e6e73' }}
              >
                {headerMeta.crumbs.map((c, idx) => {
                  const isLast = idx === headerMeta.crumbs.length - 1
                  return (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                      {c.href ? (
                        <Link
                          href={c.href}
                          className="transition-colors hover:text-slate-700 text-xs sm:text-sm"
                        >
                          {c.label}
                        </Link>
                      ) : (
                        <span className={`${isLast ? 'text-slate-700' : ''} text-xs sm:text-sm`}>
                          {c.label}
                        </span>
                      )}
                      {!isLast && <span aria-hidden="true" className="text-slate-300 text-xs">/</span>}
                    </span>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Right Side: Clock & Notification Bell */}
        <div className="flex items-center gap-3">
          <div className="hidden min-h-11 items-center gap-2 rounded-full border border-black/[0.06] bg-white/60 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:flex">
            <ClockTime />
          </div>

          <NotificationBell />
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
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <>
      <Clock size={17} className="text-sky-600" aria-hidden="true" />
      <span>{formatted}</span>
    </>
  )
})
