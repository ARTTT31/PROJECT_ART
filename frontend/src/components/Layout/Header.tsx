'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, Clock, LogOut, Menu, User } from 'lucide-react'
import { AuthUser } from '@/types'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  user: AuthUser | null
  onMenuClick: () => void
  onLogout: () => void
  sidebarCollapsed?: boolean
}

export default function Header({ user, onMenuClick, onLogout, sidebarCollapsed = false }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const userName = user?.name || 'ผู้ใช้งาน'
  const userEmail = user?.email || ''
  const userRole = user?.role
  const userInitial = userName.charAt(0).toUpperCase() || 'U'
  const onLogoutClick = useCallback(() => { setShowUserMenu(false); onLogout() }, [onLogout])

  // Close menu on ESC and restore focus to trigger
  useEffect(() => {
    if (!showUserMenu) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showUserMenu])

  const headerMeta = (() => {
    if (pathname.startsWith('/camera')) {
      return {
        title: 'กล้องวงจรปิด',
        subtitle: 'ระบบตรวจสอบความปลอดภัย',
        crumbs: [
          { label: 'หน้าหลัก', href: '/dashboard' },
          { label: 'กล้องวงจรปิด' },
        ],
      }
    }

    if (pathname.startsWith('/profile')) {
      return {
        title: 'โปรไฟล์',
        subtitle: 'จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี',
        crumbs: [
          { label: 'หน้าหลัก', href: '/dashboard' },
          { label: 'โปรไฟล์' },
        ],
      }
    }

    // default: dashboard
    return {
      title: 'ภาพรวม',
      subtitle: 'แดชบอร์ดหลักของคุณ',
      crumbs: [{ label: 'หน้าหลัก' }],
    }
  })()

  return (
    <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/75 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)]">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
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
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: '#1d1d1f' }}>{headerMeta.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#6e6e73' }}>
                {headerMeta.crumbs.map((c, idx) => {
                  const isLast = idx === headerMeta.crumbs.length - 1
                  return (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                      {c.href ? (
                        <Link href={c.href} className="transition-colors hover:text-slate-700 text-xs sm:text-sm">
                          {c.label}
                        </Link>
                      ) : (
                        <span className={`${isLast ? 'text-slate-700' : ''} text-xs sm:text-sm`}>{c.label}</span>
                      )}
                      {!isLast && <span aria-hidden="true" className="text-slate-300 text-xs">/</span>}
                    </span>
                  )
                })}
              </nav>
              <span aria-hidden="true" className="hidden text-slate-300 sm:inline">•</span>
              <p className="hidden max-w-[200px] truncate text-sm font-medium text-slate-500 sm:block">{headerMeta.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden min-h-11 items-center gap-2 rounded-full border border-black/[0.06] bg-white/60 px-3 py-2 text-sm font-semibold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:flex">
            <ClockTime />
          </div>

          <NotificationBell />

          <div className="relative" ref={menuRef}>
            <button
              ref={triggerRef}
              onClick={() => setShowUserMenu((v) => !v)}
              className="art-soft-button !min-h-11 !gap-3 !rounded-xl !px-2 !py-1.5"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              aria-label="เปิดเมนูผู้ใช้"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-sm font-semibold text-white">
                {userInitial}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold text-slate-950">{userName}</div>
                <div className="text-xs text-slate-500">{userRole === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</div>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform duration-150 ${showUserMenu ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {showUserMenu && (
              <>
                {/* Click-outside overlay */}
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setShowUserMenu(false)}
                  aria-label="ปิดเมนูผู้ใช้"
                  tabIndex={-1}
                />
                {/* Dropdown */}
                <div
                  role="menu"
                  aria-label="เมนูผู้ใช้"
                  className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{userName}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{userEmail}</div>
                  </div>

                  <a
                    href="/profile"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-[#f5f5f7]"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User size={18} className="text-slate-500" aria-hidden="true" />
                    โปรไฟล์ของฉัน
                  </a>

                  <button
                    onClick={onLogoutClick}
                    role="menuitem"
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut size={18} aria-hidden="true" />
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

/** Isolated clock component – only this subtree re-renders every second */
const ClockTime = memo(function ClockTime() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60_000) // update every minute, not every second
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
