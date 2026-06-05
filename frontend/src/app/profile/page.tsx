'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { showToast, showSuccess, showError } from '@/utils/sweetalert'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const fetchSessions = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/profile/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.result === 'success') {
          setSessions(data.data || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/profile/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (response.ok) {
        showSuccess('สำเร็จ', 'ออกจากระบบจากอุปกรณ์นี้แล้ว')
        fetchSessions()
      } else {
        const data = await response.json()
        showError('เกิดข้อผิดพลาด', data.detail || 'ไม่สามารถออกจากระบบของอุปกรณ์นี้ได้')
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์')
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    setName(parsedUser.name || '')
    setEmail(parsedUser.email || '')
  }, [router])

  useEffect(() => {
    // Calculate password strength
    if (!newPassword) {
      setPasswordStrength(0)
      return
    }

    let strength = 0
    if (newPassword.length >= 8) strength++
    if (newPassword.length >= 12) strength++
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++
    if (/\d/.test(newPassword)) strength++
    if (/[^a-zA-Z0-9]/.test(newPassword)) strength++

    setPasswordStrength(strength)
  }, [newPassword])

  const getStrengthLabel = () => {
    if (passwordStrength === 0) return ''
    if (passwordStrength === 1) return 'อ่อนมาก'
    if (passwordStrength === 2) return 'อ่อน'
    if (passwordStrength === 3) return 'ปานกลาง'
    if (passwordStrength === 4) return 'แข็งแรง'
    return 'แข็งแรงมาก'
  }

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-red-500'
    if (passwordStrength === 2) return 'bg-orange-500'
    if (passwordStrength === 3) return 'bg-yellow-500'
    if (passwordStrength === 4) return 'bg-green-500'
    return 'bg-emerald-500'
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const token = localStorage.getItem('access_token')
    if (!token) {
      showError('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่')
      router.push('/login')
      return
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Update localStorage with new user data
        const updatedUser = { ...user, name, email }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        
        // Dispatch custom event to notify layout (Header/Sidebar)
        window.dispatchEvent(new Event('user-profile-updated'))
        
        showSuccess('สำเร็จ', data.message || 'อัปเดตโปรไฟล์สำเร็จ!')
      } else {
        // Handle authentication errors
        if (response.status === 401) {
          showError('สิทธิ์การใช้งานหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่')
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
          router.push('/login')
        } else {
          showError('เกิดข้อผิดพลาด', data.detail || 'เกิดข้อผิดพลาดในการอัพเดทโปรไฟล์')
        }
      }
    } catch (error) {
      console.error('Profile update error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!oldPassword) {
      showToast('กรุณากรอกรหัสผ่านปัจจุบัน', 'warning')
      return
    }

    if (!newPassword) {
      showToast('กรุณากรอกรหัสผ่านใหม่', 'warning')
      return
    }

    if (newPassword.length < 8) {
      showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', 'warning')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('รหัสผ่านใหม่ไม่ตรงกัน', 'warning')
      return
    }

    if (passwordStrength < 3) {
      showToast('รหัสผ่านไม่แข็งแรงพอ กรุณาใช้รหัสผ่านที่ปลอดภัยกว่านี้', 'warning')
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      showError('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่')
      router.push('/login')
      return
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/profile/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('สำเร็จ', data.message || 'เปลี่ยนรหัสผ่านสำเร็จ!')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        // Handle authentication errors
        if (response.status === 401) {
          showError('สิทธิ์การใช้งานหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่')
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
          router.push('/login')
        } else {
          showError('เกิดข้อผิดพลาด', data.detail || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน')
        }
      }
    } catch (error) {
      console.error('Password change error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">จัดการบัญชี</h1>
          <p className="text-gray-600 mt-1">จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="premium-card overflow-hidden !rounded-[24px]">
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-sky-400/30 to-blue-600/30 backdrop-blur-xl"></div>
              
              {/* Profile Content */}
              <div className="px-6 pb-6 -mt-16 text-center">
                {/* Avatar */}
                <div className="relative inline-block mb-4">
                  <div className="w-32 h-32 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <button className="absolute bottom-2 right-2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors border-2 border-gray-100">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {/* User Info */}
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{user.name || 'ผู้ใช้งาน'}</h2>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  user.role === 'admin' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
                </span>

                {/* Last Login */}
                <div className="mt-6 rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md p-4 text-left shadow-glass-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    เข้าใช้งานล่าสุด:
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Date().toLocaleString('th-TH')}
                  </div>
                </div>

                {/* Login History */}
                <div className="mt-4 text-left">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ประวัติการเข้าใช้
                  </h3>
                  <div className="space-y-3 text-sm max-h-[220px] overflow-y-auto pr-1">
                    {loadingSessions ? (
                      <div className="text-gray-400 text-xs py-2">กำลังโหลดข้อมูล...</div>
                    ) : sessions.length === 0 ? (
                      <div className="text-gray-400 text-xs py-2">ไม่มีประวัติการเข้าใช้งาน</div>
                    ) : (
                      sessions.map((session: any) => {
                        const date = session.created_at ? new Date(session.created_at) : null;
                        const timeText = date ? date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'ไม่ระบุ';
                        const currentSessionId = localStorage.getItem('session_id');
                        const isCurrent = session.session_id === currentSessionId;
                        
                        return (
                          <div key={session.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                            <div className="flex items-start gap-2 overflow-hidden">
                              <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${session.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-gray-700 font-medium text-xs truncate">
                                  {session.device_label}
                                  {isCurrent && <span className="ml-1 text-[10px] text-green-600 font-semibold bg-green-50 px-1 py-0.5 rounded border border-green-200">เครื่องนี้</span>}
                                </span>
                                <span className="text-gray-400 text-[10px] truncate">{session.ip_address}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-gray-400 text-[10px] whitespace-nowrap">{timeText}</span>
                              {!isCurrent && session.is_active && (
                                <button
                                  onClick={() => handleRevokeSession(session.session_id)}
                                  title="เตะออกจากระบบ"
                                  className="text-red-500 hover:text-red-700 p-0.5 hover:bg-red-50 rounded transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Update Profile Form */}
            <div className="premium-card p-6 !rounded-[24px]">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">ข้อมูลบัญชี</h2>
                  <p className="text-sm text-gray-600">อัพเดทข้อมูลส่วนตัวของคุณ</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อที่แสดง
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="art-input w-full px-4 py-3"
                      placeholder="เช่น สมชาย ใจดี"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      อีเมล
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="art-input w-full px-4 py-3"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <strong>หมายเหตุ:</strong> หากเปลี่ยนอีเมล ครั้งถัดไปให้ล็อกอินด้วยอีเมลใหม่ (รหัสผ่านเดิม)
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="art-primary-button px-6 py-3"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      บันทึกข้อมูล
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="premium-card p-6 !rounded-[24px]">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
                  <p className="text-sm text-gray-600">อัพเดทรหัสผ่านเพื่อความปลอดภัย</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                {/* Old Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    รหัสผ่านปัจจุบัน
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="art-input w-full px-4 py-3 pr-12"
                      placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showOldPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      รหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="art-input w-full px-4 py-3 pr-12"
                        placeholder="อย่างน้อย 8 ตัวอักษร"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Password Strength Meter */}
                    {newPassword && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                            style={{ width: `${(passwordStrength / 5) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          ความแข็งแรง: <span className="font-medium">{getStrengthLabel()}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="art-input w-full px-4 py-3 pr-12"
                        placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-red-500/90 text-white rounded-2xl font-bold hover:bg-red-500 hover:-translate-y-0.5 transition-all shadow-[0_4px_14px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.5)] border border-red-400/50 backdrop-blur-md"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      บันทึกรหัสผ่านใหม่
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
