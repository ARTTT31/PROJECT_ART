'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { showConfirm } from '@/utils/sweetalert'
import AuthGuard from '@/components/Auth/AuthGuard'
import { useAuth } from '@/hooks/useAuth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    const result = await showConfirm('ต้องการออกจากระบบหรือไม่?', 'กดยืนยันเพื่อออกจากระบบ')
    if (result.isConfirmed) {
      await logout()
      router.replace('/login')
    }
  }

  return (
    <AuthGuard>
      <div className="art-app-shell relative overflow-x-hidden bg-[#f5f5f7] min-h-[100dvh] text-[#1d1d1f]">
        {/* Sidebar wrapper */}
        <div className="relative z-20">

          <Sidebar
            isOpen={sidebarOpen}
            isCollapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            user={user}
            onLogout={handleLogout}
          />
        </div>

        {/* Main Content wrapper */}
        <div
          className={`relative z-10 min-h-[100dvh] flex flex-col transition-[padding] duration-300 ease-out ${
            sidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'
          }`}
        >
          {/* Header */}
          <Header
            user={user}
            onMenuClick={() => {
              if (window.matchMedia('(min-width: 1024px)').matches) {
                setSidebarCollapsed((value) => !value)
                return
              }
              setSidebarOpen(true)
            }}
            sidebarCollapsed={sidebarCollapsed}
            onLogout={handleLogout}
          />

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm transition-all duration-300 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </div>
    </AuthGuard>
  )
}
