'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, Clock, LogOut, Menu, User, Settings } from 'lucide-react'
import { DashboardUser } from '@/types'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  user: DashboardUser | null
  onMenuClick: () => void
  onLogout: () => void
}

export default function Header({ user, onMenuClick, onLogout }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pathname = usePathname()

  const userName = user?.name || 'ผู้ใช้งาน'
  const userEmail = user?.email || ''
  const userRole = user?.role
  const userInitial = userName.charAt(0).toUpperCase() || 'U'
  const onLogoutClick = useCallback(() => { setShowUserMenu(false); onLogout() }, [onLogout])

  const formatTime = (date: Date) => {
    return date.toLocaleString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const headerMeta = (() => {
    if (pathname.startsWith('/admin')) {
      return {
        title: 'จัดการระบบ',
        subtitle: 'จัดการผู้ใช้และตรวจสอบบันทึกการทำงาน',
        crumbs: [
          { label: 'หน้าหลัก', href: '/dashboard' },
          { label: 'จัดการระบบ' },
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
    <header className="sticky top-0 z-20 glass-surface border-b border-white/30 !bg-white/70 backdrop-blur-[24px]">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu size={22} aria-hidden="true" />
          </button>

          <div>
            <h1 className="text-xl font-bold text-slate-950">{headerMeta.title}</h1>
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                {headerMeta.crumbs.map((c, idx) => {
                  const isLast = idx === headerMeta.crumbs.length - 1
                  return (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                      {c.href ? (
                        <Link href={c.href} className="hover:text-slate-700 transition-colors">
                          {c.label}
                        </Link>
                      ) : (
                        <span className={isLast ? 'text-slate-700' : ''}>{c.label}</span>
                      )}
                      {!isLast && <span aria-hidden="true" className="text-slate-300">/</span>}
                    </span>
                  )
                })}
              </nav>
              <span aria-hidden="true" className="text-slate-300">•</span>
              <p className="text-sm font-medium text-slate-500">{headerMeta.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden min-h-11 items-center gap-2 rounded-full border border-white/40 bg-white/50 px-3 py-2 text-sm font-semibold text-slate-700 md:flex shadow-glass-sm">
            <ClockTime />
          </div>

          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/40 bg-white/60 px-2 py-1.5 shadow-glass-sm transition-colors hover:bg-white/80"
              aria-expanded={showUserMenu}
              aria-label="เปิดเมนูผู้ใช้"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-sm font-semibold text-white">
                {userInitial}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold text-slate-950">{userName}</div>
                <div className="text-xs text-slate-500">{userRole === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</div>
              </div>
              <ChevronDown size={16} className="text-slate-400" aria-hidden="true" />
            </button>

            {showUserMenu && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setShowUserMenu(false)}
                  aria-label="ปิดเมนูผู้ใช้"
                />
                <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{userName}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{userEmail}</div>
                  </div>

                  {userRole === 'admin' && (
                    <a href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 border-b border-slate-100">
                      <Settings size={18} className="text-slate-600" aria-hidden="true" />
                      จัดการระบบ
                    </a>
                  )}

                  <a href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50">
                    <User size={18} className="text-slate-600" aria-hidden="true" />
                    โปรไฟล์ของฉัน
                  </a>

                  <button
                    onClick={onLogoutClick}
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
