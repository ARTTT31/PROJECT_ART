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

  const handleLogout = () => {
    showConfirm('ต้องการออกจากระบบหรือไม่?', 'กดยืนยันเพื่อออกจากระบบ').then((result) => {
      if (result.isConfirmed) {
        logout()
        router.replace('/login')
      }
    })
  }

  return (
    <AuthGuard>
      <div className="art-app-shell relative overflow-x-hidden">
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
          className={`relative z-10 min-h-[100dvh] flex flex-col transition-[padding] duration-300 ${
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
          <main className="flex-1 p-3 sm:p-4 lg:p-6">{children}</main>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm transition-all duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </AuthGuard>
  )
}
