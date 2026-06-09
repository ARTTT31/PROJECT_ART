'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Clock, LogOut, Menu, User, Settings } from 'lucide-react'

interface HeaderProps {
  user: any
  onMenuClick: () => void
  onLogout: () => void
}

export default function Header({ user, onMenuClick, onLogout }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

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
            <h1 className="text-xl font-bold text-slate-950">ภาพรวม</h1>
            <p className="hidden text-sm text-slate-500 sm:block">หน้าหลัก</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden min-h-11 items-center gap-2 rounded-full border border-white/40 bg-white/50 px-3 py-2 text-sm font-semibold text-slate-700 md:flex backdrop-blur-md shadow-glass-sm">
            <Clock size={17} className="text-sky-600" aria-hidden="true" />
            <span>{formatTime(currentTime)}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/40 bg-white/60 px-2 py-1.5 shadow-glass-sm transition-colors hover:bg-white/80 backdrop-blur-md"
              aria-expanded={showUserMenu}
              aria-label="เปิดเมนูผู้ใช้"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-sm font-semibold text-white">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold text-slate-950">{user.name || 'ผู้ใช้งาน'}</div>
                <div className="text-xs text-slate-500">{user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</div>
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
                <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-white/50 bg-white/80 backdrop-blur-xl shadow-glass-lg">
                  <div className="border-b border-slate-200/50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-950">{user.name || 'ผู้ใช้งาน'}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{user.email}</div>
                  </div>

                  {user.role === 'admin' && (
                    <a href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 border-b border-slate-100">
                      <Settings size={18} className="text-slate-400" aria-hidden="true" />
                      ระบบหลังบ้าน (Admin)
                    </a>
                  )}

                  <a href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                    <User size={18} className="text-slate-400" aria-hidden="true" />
                    โปรไฟล์ของฉัน
                  </a>

                  <button
                    onClick={onLogout}
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
