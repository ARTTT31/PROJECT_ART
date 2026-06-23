'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Link2, PencilLine, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert'
import { useAuth } from '@/hooks/useAuth'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import {
  QUICK_LINK_ICON_MAP,
  QUICK_LINK_ICON_OPTIONS,
  type QuickLink,
  isExternalUrl,
  parseQuickLinks,
  serializeQuickLinks,
} from '@/utils/quickLinks'

function describeQuickLink(url: string) {
  const value = url.trim()

  if (!value) {
    return {
      tone: 'ยังไม่ระบุ',
      title: 'รอระบุปลายทาง',
      subtitle: 'ลิงก์นี้จะแสดงใน Sidebar',
    }
  }

  if (isExternalUrl(value)) {
    try {
      const parsed = new URL(value)
      return {
        tone: 'ภายนอก',
        title: parsed.hostname.replace(/^www\./, '') || value,
        subtitle: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : 'ลิงก์ภายนอก',
      }
    } catch {
      return {
        tone: 'ภายนอก',
        title: value,
        subtitle: 'ลิงก์ภายนอก',
      }
    }
  }

  return {
    tone: 'ภายใน',
    title: 'เส้นทางภายในระบบ',
    subtitle: value,
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { user: authUser, updateUser } = useAuth()
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

  // Quick Links
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [quickLinkDialogOpen, setQuickLinkDialogOpen] = useState(false)
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null)
  const [qlLabel, setQlLabel] = useState('')
  const [qlUrl, setQlUrl] = useState('')
  const [qlIcon, setQlIcon] = useState<QuickLink['icon']>('link')
  const [qlColor, setQlColor] = useState('#0ea5e9')
  const previewMeta = describeQuickLink(qlUrl)
  const PreviewIcon = QUICK_LINK_ICON_MAP[qlIcon]
  const previewIconLabel =
    QUICK_LINK_ICON_OPTIONS.find((option) => option.key === qlIcon)?.label ?? 'ลิงก์'

  useEffect(() => {
    if (authUser) {
      setUser(authUser)
      setName(authUser.name || '')
      setEmail(authUser.email || '')
      setQuickLinks(parseQuickLinks(authUser.quick_links))
    }
  }, [authUser])

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

    try {
      const response = await fetchWithAuth('/api/v1/profile/me', {
        method: 'PUT',
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
        updateUser({ name, email })
        
        // Dispatch custom event to notify layout (Header/Sidebar)
        window.dispatchEvent(new Event('user-profile-updated'))
        
        showSuccess('สำเร็จ', data.message || 'อัปเดตโปรไฟล์สำเร็จ!')
      } else {
        showError('เกิดข้อผิดพลาด', data.detail || 'เกิดข้อผิดพลาดในการอัพเดทโปรไฟล์')
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

    const userData = localStorage.getItem('user')
    if (!userData) {
      showError('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่')
      router.push('/login')
      return
    }

    try {
      const response = await fetchWithAuth('/api/v1/profile/change-password', {
        method: 'POST',
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
        showError('เกิดข้อผิดพลาด', data.detail || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน')
      }
    } catch (error) {
      console.error('Password change error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    }
  }

  const openCreateQuickLink = () => {
    setEditingQuickLinkId(null)
    setQlLabel('')
    setQlUrl('')
    setQlIcon('link')
    setQlColor('#0ea5e9')
    setQuickLinkDialogOpen(true)
  }

  const openEditQuickLink = (link: QuickLink) => {
    setEditingQuickLinkId(link.id)
    setQlLabel(link.label)
    setQlUrl(link.url)
    setQlIcon(link.icon)
    setQlColor(link.color || '#0ea5e9')
    setQuickLinkDialogOpen(true)
  }

  const persistQuickLinks = async (nextLinks: QuickLink[]) => {
    try {
      const raw = serializeQuickLinks(nextLinks)

      const response = await fetchWithAuth('/api/v1/profile/quick-links', {
        method: 'POST',
        body: JSON.stringify({ quick_links: raw }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({} as any))
        showError('เกิดข้อผิดพลาด', data.detail || 'ไม่สามารถบันทึก Quick Links ได้')
        return false
      }

      // Sync to local + Auth context (เพื่อให้ Sidebar เห็นทันที)
      const updatedUser = { ...user, quick_links: raw }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)
      updateUser({ quick_links: raw })
      window.dispatchEvent(new Event('user-profile-updated'))

      setQuickLinks(nextLinks)
      return true
    } catch (error) {
      console.error('Quick links update error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
      return false
    }
  }

  const handleSubmitQuickLink = async (e: React.FormEvent) => {
    e.preventDefault()

    const label = qlLabel.trim()
    const url = qlUrl.trim()

    if (!label) {
      showToast('กรุณากรอกชื่อควิกลิ้งค์', 'warning')
      return
    }

    if (!url) {
      showToast('กรุณากรอกลิงก์', 'warning')
      return
    }

    const isValid = isExternalUrl(url) || url.startsWith('/')
    if (!isValid) {
      showToast('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ / (ลิงก์ภายใน)', 'warning')
      return
    }

    const next: QuickLink = {
      id:
        editingQuickLinkId ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      label,
      url,
      icon: qlIcon,
      color: qlColor || undefined,
    }

    const nextLinks =
      editingQuickLinkId
        ? quickLinks.map((l) => (l.id === editingQuickLinkId ? next : l))
        : [...quickLinks, next]

    const ok = await persistQuickLinks(nextLinks)
    if (ok) {
      setQuickLinkDialogOpen(false)
      showSuccess('สำเร็จ', 'บันทึก Quick Links สำเร็จ')
    }
  }

  const handleMoveQuickLink = async (id: string, direction: 'up' | 'down') => {
    const idx = quickLinks.findIndex(l => l.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === quickLinks.length - 1) return
    const next = [...quickLinks]
    const swap = direction === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    await persistQuickLinks(next)
  }

  const handleDeleteQuickLink = async (id: string) => {
    const result = await showDeleteConfirm('ลบควิกลิ้งค์?', 'ต้องการลบควิกลิ้งค์นี้ใช่หรือไม่')
    if (!result.isConfirmed) return
    const nextLinks = quickLinks.filter((l) => l.id !== id)
    const ok = await persistQuickLinks(nextLinks)
    if (ok) showSuccess('สำเร็จ', 'ลบควิกลิ้งค์แล้ว')
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">จัดการบัญชี</h1>
          <p className="text-slate-600 mt-1">จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="premium-card overflow-hidden !rounded-[14px]">
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-sky-400/30 to-blue-600/30 backdrop-blur-xl"></div>
              
              {/* Profile Content */}
              <div className="px-4 sm:px-6 pb-6 -mt-12 sm:-mt-16 text-center">
                {/* Avatar */}
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold border-4 border-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <button className="art-icon-button absolute bottom-2 right-2 !h-10 !w-10 !rounded-full" aria-label="เปลี่ยนรูปโปรไฟล์">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {/* User Info */}
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{user.name || 'ผู้ใช้งาน'}</h2>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  user.role === 'admin' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
                </span>

              </div>
            </div>
          </div>

          {/* Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Update Profile Form */}
            <div className="premium-card p-4 sm:p-6 !rounded-[14px]">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">ข้อมูลบัญชี</h2>
                  <p className="text-sm text-slate-600">อัพเดทข้อมูลส่วนตัวของคุณ</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
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
                    <label className="block text-sm font-medium text-slate-700 mb-2">
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
            <div className="premium-card p-4 sm:p-6 !rounded-[14px]">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">เปลี่ยนรหัสผ่าน</h2>
                  <p className="text-sm text-slate-600">อัพเดทรหัสผ่านเพื่อความปลอดภัย</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                {/* Old Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
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
                      className="art-icon-button absolute right-3 top-1/2 !h-10 !w-10 -translate-y-1/2 !border-transparent !bg-transparent !shadow-none"
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
                    <label className="block text-sm font-medium text-slate-700 mb-2">
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
                        className="art-icon-button absolute right-3 top-1/2 !h-10 !w-10 -translate-y-1/2 !border-transparent !bg-transparent !shadow-none"
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
                      <div className="mt-2" aria-live="polite">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                            style={{ width: `${(passwordStrength / 5) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          ความแข็งแรง: <span className="font-medium">{getStrengthLabel()}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
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
                        className="art-icon-button absolute right-3 top-1/2 !h-10 !w-10 -translate-y-1/2 !border-transparent !bg-transparent !shadow-none"
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
                    className="art-primary-button px-6 py-3"
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

            {/* Quick Links */}
            <div className="art-surface p-6 !rounded-[14px]">
              <div className="mb-6 border-b border-slate-200/70 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                      <Link2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">ควิกลิ้งค์</h2>
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          {quickLinks.length} รายการ
                        </span>
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-slate-600">
                        รวมลิงก์ที่ใช้บ่อยไว้ใน Sidebar เพื่อเปิดได้เร็วขึ้น แยกให้อ่านง่ายทั้งลิงก์ภายในและลิงก์ภายนอก
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateQuickLink}
                    className="art-primary-button inline-flex flex-shrink-0 items-center gap-2 px-4 py-2.5"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    เพิ่ม
                  </button>
                </div>
              </div>

              {quickLinks.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-[0_10px_25px_rgba(15,23,42,0.08)]">
                    <Link2 className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">ยังไม่มีควิกลิ้งค์</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    เพิ่มลิงก์ที่เปิดบ่อย เช่น Google Drive, ปฏิทิน หรือหน้าภายในระบบ เพื่อให้เข้าถึงได้จาก Sidebar ทันที
                  </p>
                  <button
                    type="button"
                    onClick={openCreateQuickLink}
                    className="art-primary-button mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    สร้างควิกลิ้งค์แรก
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {quickLinks.map((link) => {
                    const Icon = QUICK_LINK_ICON_MAP[link.icon]
                    const linkMeta = describeQuickLink(link.url)
                    const external = isExternalUrl(link.url)

                    return (
                      <div
                        key={link.id}
                        className="rounded-[12px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:border-sky-200 hover:bg-white"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                              <Icon size={20} aria-hidden="true" style={{ color: link.color || '#0ea5e9' }} />
                            </div>

                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-bold text-slate-900">{link.label}</div>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    external ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'
                                  }`}
                                >
                                  {linkMeta.tone}
                                </span>
                              </div>
                              <div className="truncate text-sm font-medium text-slate-700">{linkMeta.title}</div>
                              <div className="truncate text-xs text-slate-500">{linkMeta.subtitle}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => handleMoveQuickLink(link.id, 'up')}
                              disabled={quickLinks.indexOf(link) === 0}
                              aria-label="ย้ายขึ้น"
                              className="art-icon-button small-control !h-9 !w-9 !rounded-lg"
                            >
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuickLink(link.id, 'down')}
                              disabled={quickLinks.indexOf(link) === quickLinks.length - 1}
                              aria-label="ย้ายลง"
                              className="art-icon-button small-control !h-9 !w-9 !rounded-lg"
                            >
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <a
                              href={link.url}
                              target={external ? '_blank' : undefined}
                              rel={external ? 'noopener noreferrer' : undefined}
                              className="art-soft-button !min-h-9 !gap-1.5 !px-3 !py-1.5 !text-xs"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              เปิด
                            </a>
                            <button
                              type="button"
                              onClick={() => openEditQuickLink(link)}
                              className="art-soft-button !min-h-9 !gap-1.5 !px-3 !py-1.5 !text-xs"
                            >
                              <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuickLink(link.id)}
                              className="art-soft-button !min-h-9 !gap-1.5 !border-red-200 !bg-red-50/80 !px-3 !py-1.5 !text-xs !text-red-700 hover:!bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              ลบ
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <Dialog open={quickLinkDialogOpen} onOpenChange={setQuickLinkDialogOpen}>
                <DialogContent
                  title={editingQuickLinkId ? 'แก้ไขควิกลิ้งค์' : 'เพิ่มควิกลิ้งค์'}
                  description="ควิกลิ้งค์ที่สร้างจะไปแสดงที่ Sidebar ของหน้าหลัก"
                  className="!max-w-2xl"
                >
                  <form onSubmit={handleSubmitQuickLink} className="space-y-4">
                    <div className="rounded-[12px] border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                            <PreviewIcon size={20} aria-hidden="true" style={{ color: qlColor || '#0ea5e9' }} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">
                              {qlLabel.trim() || 'ตัวอย่างควิกลิ้งค์'}
                            </div>
                            <div className="truncate text-sm text-slate-600">{previewMeta.title}</div>
                            <div className="truncate text-xs text-slate-500">{previewMeta.subtitle}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <PreviewIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            ไอคอน {previewIconLabel}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              previewMeta.tone === 'ภายนอก'
                                ? 'bg-sky-50 text-sky-700'
                                : previewMeta.tone === 'ภายใน'
                                  ? 'bg-violet-50 text-violet-700'
                                  : 'bg-slate-200/80 text-slate-600'
                            }`}
                          >
                            {previewMeta.tone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">ชื่อปุ่ม</label>
                      <input
                        value={qlLabel}
                        onChange={(e) => setQlLabel(e.target.value)}
                        autoFocus
                        className="art-input w-full px-4 py-3"
                        placeholder="เช่น Google Drive"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">ลิงก์</label>
                      <input
                        value={qlUrl}
                        onChange={(e) => setQlUrl(e.target.value)}
                        className="art-input w-full px-4 py-3"
                        placeholder="https://... หรือ /dashboard"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        รองรับลิงก์ภายนอก (http/https) หรือเส้นทางภายในขึ้นต้นด้วย /
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)]">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">ไอคอน</label>
                        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                          {QUICK_LINK_ICON_OPTIONS.map((opt) => {
                            const OptionIcon = QUICK_LINK_ICON_MAP[opt.key]
                            const isSelected = qlIcon === opt.key

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setQlIcon(opt.key)}
                                aria-pressed={isSelected}
                                aria-label={`เลือกไอคอน ${opt.label}`}
                                title={opt.label}
                                className={`art-chip-button h-[52px] w-full !rounded-[var(--art-radius-lg)] !p-2 ${
                                  isSelected
                                    ? 'is-active'
                                    : ''
                                }`}
                              >
                                <span
                                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                                    isSelected
                                      ? 'border-sky-200 bg-white text-sky-600'
                                      : 'border-slate-200 bg-slate-50 text-slate-500'
                                  }`}
                                >
                                  <OptionIcon className="h-4 w-4" aria-hidden="true" />
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">สี</label>
                        <div className="rounded-[12px] border border-slate-200 bg-slate-50/80 p-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={qlColor}
                              onChange={(e) => setQlColor(e.target.value)}
                              className="art-color-input"
                              aria-label="เลือกสี"
                            />
                            <input
                              value={qlColor}
                              onChange={(e) => setQlColor(e.target.value)}
                              className="art-input flex-1 px-4 py-3"
                              placeholder="#0ea5e9"
                            />
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(148,163,184,0.28)]"
                              style={{ backgroundColor: qlColor || '#0ea5e9' }}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-medium text-slate-500">
                              สีที่เลือกจะใช้กับไอคอนใน Sidebar
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-500">
                        ปลายทางจะถูกบันทึกและแสดงใน Sidebar ทันทีหลังจากกดบันทึก
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setQuickLinkDialogOpen(false)}
                          className="art-soft-button px-4 py-2.5 text-sm"
                        >
                          ยกเลิก
                        </button>
                        <button type="submit" className="art-primary-button px-5 py-2.5">
                          บันทึก
                        </button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
