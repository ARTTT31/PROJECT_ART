'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { showConfirm } from '@/utils/sweetalert'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('access_token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    setUser(JSON.parse(userData))
  }, [router])

  useEffect(() => {
    const handleProfileUpdate = () => {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    }

    window.addEventListener('user-profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdate)
  }, [])

  const handleLogout = () => {
    showConfirm('ต้องการออกจากระบบหรือไม่?', 'กดยืนยันเพื่อออกจากระบบ').then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('session_id')
        localStorage.removeItem('user')
        router.push('/login')
      }
    })
  }

  if (!user) {
    return null
  }

  return (
    <div className="art-app-shell relative overflow-hidden">

      {/* Sidebar wrapper */}
      <div className="relative z-20">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Content wrapper */}
      <div className="lg:pl-64 relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <Header 
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
