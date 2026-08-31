'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Camera,
  User,
  Lock,
  Info,
  Check,
  Save,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  PencilLine,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  KeyRound,
  Mail,
  Shield,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert'
import { useAuth } from '@/hooks/useAuth'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import {
  QUICK_LINK_ICON_MAP,
  QUICK_LINK_ICON_OPTIONS,
  type QuickLink,
  isExternalUrl,
  parseQuickLinks,
  serializeQuickLinks,
} from '@/utils/quickLinks'
import {
  DEFAULT_MAIN_MENU_ITEMS,
  MAIN_MENU_ICON_MAP,
  MAIN_MENU_STORAGE_KEY,
  MainMenuItemConfig,
  parseMainMenuConfig,
  serializeMainMenuConfig,
} from '@/utils/mainMenu'

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
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Main Menu Management
  const [mainMenuItems, setMainMenuItems] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null)
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY)
    return parseMainMenuConfig(saved)
  })

  const handleToggleMainMenu = (id: string) => {
    setMainMenuItems((prev) => {
      const next = prev.map((item) => {
        if (item.id === id) {
          if (item.required) return item
          return { ...item, enabled: !item.enabled }
        }
        return item
      })
      const serialized = serializeMainMenuConfig(next)
      if (typeof window !== 'undefined') {
        localStorage.setItem(MAIN_MENU_STORAGE_KEY, serialized)
        window.dispatchEvent(new Event('art-main-menu-updated'))
      }
      const targetItem = next.find((i) => i.id === id)
      showToast(
        targetItem?.enabled
          ? `เปิดการแสดงผล "${targetItem?.name}" ในเมนูหลักแล้ว`
          : `ซ่อน "${targetItem?.name}" จากเมนูหลักแล้ว`,
        'success',
      )
      return next
    })
  }

  const handleResetMainMenu = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MAIN_MENU_STORAGE_KEY)
      window.dispatchEvent(new Event('art-main-menu-updated'))
    }
    setMainMenuItems(DEFAULT_MAIN_MENU_ITEMS)
    showToast('รีเซ็ตการแสดงผลเมนูหลักเป็นค่าเริ่มต้นแล้ว', 'info')
  }

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
    if (passwordStrength === 0) return 'ยังไม่ได้ระบุ'
    if (passwordStrength === 1) return 'อ่อนมาก'
    if (passwordStrength === 2) return 'อ่อน'
    if (passwordStrength === 3) return 'ปานกลาง'
    if (passwordStrength === 4) return 'แข็งแรง'
    return 'ปลอดภัยสูงมาก'
  }

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-rose-500 text-rose-700'
    if (passwordStrength === 2) return 'bg-amber-500 text-amber-700'
    if (passwordStrength === 3) return 'bg-yellow-500 text-yellow-700'
    if (passwordStrength === 4) return 'bg-emerald-500 text-emerald-700'
    return 'bg-emerald-600 text-emerald-800'
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const response = await fetchWithAuth('/api/v1/profile/me', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await response.json()
      if (response.ok) {
        const updatedUser = { ...user, name, email }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        updateUser({ name, email })
        window.dispatchEvent(new Event('user-profile-updated'))
        showSuccess('สำเร็จ', data.message || 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว!')
      } else {
        showError('เกิดข้อผิดพลาด', data.detail || 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword) { showToast('กรุณากรอกรหัสผ่านปัจจุบัน', 'warning'); return }
    if (!newPassword) { showToast('กรุณากรอกรหัสผ่านใหม่', 'warning'); return }
    if (newPassword.length < 8) { showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', 'warning'); return }
    if (newPassword !== confirmPassword) { showToast('รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่', 'warning'); return }
    if (passwordStrength < 3) { showToast('รหัสผ่านยังไม่แข็งแรงพอ กรุณาเพิ่มตัวเลขหรืออักขระพิเศษ', 'warning'); return }
    const userData = localStorage.getItem('user')
    if (!userData) { showError('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่'); router.push('/login'); return }

    setIsChangingPassword(true)
    try {
      const response = await fetchWithAuth('/api/v1/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      })
      const data = await response.json()
      if (response.ok) {
        showSuccess('สำเร็จ', data.message || 'เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว!')
        setOldPassword(''); setNewPassword(''); setConfirmPassword('')
      } else {
        showError('เกิดข้อผิดพลาด', data.detail || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน')
      }
    } catch (error) {
      console.error('Password change error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const openCreateQuickLink = () => {
    setEditingQuickLinkId(null)
    setQlLabel(''); setQlUrl(''); setQlIcon('link'); setQlColor('#0ea5e9')
    setQuickLinkDialogOpen(true)
  }

  const openEditQuickLink = (link: QuickLink) => {
    setEditingQuickLinkId(link.id)
    setQlLabel(link.label); setQlUrl(link.url); setQlIcon(link.icon)
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
    const label = qlLabel.trim(); const url = qlUrl.trim()
    if (!label) { showToast('กรุณากรอกชื่อควิกลิ้งค์', 'warning'); return }
    if (!url) { showToast('กรุณากรอกลิงก์ปลายทาง', 'warning'); return }
    const isValid = isExternalUrl(url) || url.startsWith('/')
    if (!isValid) { showToast('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ / (ลิงก์ภายใน)', 'warning'); return }
    const next: QuickLink = {
      id: editingQuickLinkId ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      label, url, icon: qlIcon, color: qlColor || undefined,
    }
    const nextLinks = editingQuickLinkId
      ? quickLinks.map((l) => (l.id === editingQuickLinkId ? next : l))
      : [...quickLinks, next]
    const ok = await persistQuickLinks(nextLinks)
    if (ok) { setQuickLinkDialogOpen(false); showSuccess('สำเร็จ', 'บันทึก Quick Links สำเร็จแล้ว') }
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
    if (ok) showSuccess('สำเร็จ', 'ลบควิกลิ้งค์เรียบร้อยแล้ว')
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7]">
        <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">

        {/* ── Page header ────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-5">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#1d1d1f]">
              โปรไฟล์
            </h1>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
            บัญชีใช้งานปกติ
          </div>
        </header>

        {/* ── 2-Column Responsive Layout ───────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* ── Left Column: Profile Card & Summary ────────────────── */}
          <div className="space-y-6 lg:col-span-4 xl:col-span-3">

            {/* Profile Hero Card */}
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              {/* Subtle gradient banner */}
              <div className="relative h-28 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.3),transparent_70%)]" />
              </div>

              {/* Avatar + Primary User Details */}
              <div className="relative px-5 pb-6 pt-0 text-center">
                <div className="relative -mt-14 inline-block mb-3">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-3xl font-extrabold text-white ring-4 ring-white shadow-[0_12px_28px_rgba(14,165,233,0.35)]">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-slate-50 hover:scale-105 active:scale-95"
                    aria-label="เปลี่ยนรูปโปรไฟล์"
                    title="เปลี่ยนรูปโปรไฟล์"
                  >
                    <Camera size={14} aria-hidden="true" />
                  </button>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">
                  {user.name || 'ผู้ใช้งาน'}
                </h2>
                <p className="mt-0.5 text-xs text-[#475569]">{user.email || 'ไม่มีอีเมล'}</p>

                {/* Role Pill */}
                <div className="mt-3 flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      user.role === 'admin'
                        ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
                        : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                    }`}
                  >
                    {user.role === 'admin' ? (
                      <>
                        <ShieldCheck size={13} aria-hidden="true" />
                        ผู้ดูแลระบบ (Admin)
                      </>
                    ) : (
                      <>
                        <User size={13} aria-hidden="true" />
                        ผู้ใช้งานทั่วไป
                      </>
                    )}
                  </span>
                </div>

                {/* Account Details Checklist */}
                <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100 pt-4 text-left text-xs">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#475569]">สถานะบัญชี</span>
                    <span className="font-semibold text-emerald-600">พร้อมใช้งาน</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#475569]">การยืนยันตัวตน</span>
                    <span className="font-semibold text-slate-800">รหัสผ่าน & อีเมล</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#475569]">ควิกลิ้งค์ของฉัน</span>
                    <span className="font-semibold text-[#0071e3]">{quickLinks.length} รายการ</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Right Column: Management Forms ──────────────────────── */}
          <div className="space-y-6 lg:col-span-8 xl:col-span-9">

            {/* ── 1. Account Info Form ─────────────────────────────── */}
            <div className="rounded-2xl bg-white p-5 sm:p-6 ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              {/* Header */}
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <User size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-[#1d1d1f]">
                    ข้อมูลบัญชี
                  </h2>
                  <p className="text-xs text-[#475569]">
                    อัปเดตชื่อที่แสดงและที่อยู่อีเมลสำหรับเข้าสู่ระบบ
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      ชื่อที่แสดง
                    </label>
                    <div className="relative">
                      <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl bg-[#f8fafc] py-2.5 !pl-11 !pr-4 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                        placeholder="เช่น สมชาย ใจดี"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      อีเมลสำหรับล็อกอิน
                    </label>
                    <div className="relative">
                      <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl bg-[#f8fafc] py-2.5 !pl-11 !pr-4 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                        placeholder="name@company.com"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Info Callout */}
                <div className="flex items-start gap-2.5 rounded-xl bg-sky-50/80 p-3.5 text-xs text-sky-900 ring-1 ring-sky-200/60">
                  <Info size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
                  <div>
                    <strong>คำแนะนำ:</strong> หากเปลี่ยนอีเมล การเข้าสู่ระบบครั้งถัดไปจะต้องใช้อีเมลใหม่คู่กับรหัสผ่านเดิม
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_2px_10px_rgba(0,113,227,0.3)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
                  >
                    <Check size={14} aria-hidden="true" />
                    {isSavingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>

            {/* ── 2. Change Password Form ──────────────────────────── */}
            <div className="rounded-2xl bg-white p-5 sm:p-6 ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              {/* Header */}
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/60">
                  <Lock size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-[#1d1d1f]">
                    เปลี่ยนรหัสผ่าน
                  </h2>
                  <p className="text-xs text-[#475569]">
                    อัปเดตรหัสผ่านใหม่เพื่อความปลอดภัยของบัญชี
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current password */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    รหัสผ่านปัจจุบัน
                  </label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full rounded-xl bg-[#f8fafc] py-2.5 !pl-11 !pr-11 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                      placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                      aria-label={showOldPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showOldPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* New Password */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      รหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl bg-[#f8fafc] py-2.5 !pl-11 !pr-11 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                        placeholder="อย่างน้อย 8 ตัวอักษร"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                        aria-label={showNewPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      >
                        {showNewPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="mt-2 space-y-1.5" aria-live="polite">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#475569]">ความแข็งแรงของรหัสผ่าน:</span>
                          <span className="font-bold">{getStrengthLabel()}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                            style={{ width: `${Math.min(100, (passwordStrength / 5) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl bg-[#f8fafc] py-2.5 !pl-11 !pr-11 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                        placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                        aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      >
                        {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_2px_10px_rgba(0,113,227,0.3)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
                  >
                    <Save size={14} aria-hidden="true" />
                    {isChangingPassword ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}
                  </button>
                </div>
              </form>
            </div>

            {/* ── 3. Quick Links Management ────────────────────────── */}
            <div className="rounded-2xl bg-white p-5 sm:p-6 ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              {/* Header */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-200/60">
                    <Link2 size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[17px] font-bold text-[#1d1d1f]">
                        ควิกลิ้งค์สำหรับแถบข้าง
                      </h2>
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
                        {quickLinks.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">
                      สร้างทางลัดเข้าถึงเว็บไซต์หรือหน้างานสำคัญใน Sidebar
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openCreateQuickLink}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/[0.08] shadow-sm transition-all duration-150 hover:bg-[#f5f5f7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] active:scale-[0.98]"
                >
                  <Plus size={14} aria-hidden="true" />
                  เพิ่มควิกลิ้งค์
                </button>
              </div>

              {/* Content List */}
              {quickLinks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-black/[0.06]">
                    <Link2 size={22} aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1d1d1f]">ยังไม่มีควิกลิ้งค์</h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-[#475569]">
                    เพิ่มลิงก์ที่ใช้งานบ่อย เช่น Google Drive, ปฏิทิน หรือระบบภายใน เพื่อให้คลิกเปิดได้ทันทีจาก Sidebar
                  </p>
                  <button
                    type="button"
                    onClick={openCreateQuickLink}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0077ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                  >
                    <Plus size={13} aria-hidden="true" />
                    สร้างควิกลิ้งค์แรก
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {quickLinks.map((link) => {
                    const Icon = QUICK_LINK_ICON_MAP[link.icon]
                    const linkMeta = describeQuickLink(link.url)
                    const external = isExternalUrl(link.url)

                    return (
                      <div
                        key={link.id}
                        className="flex flex-col gap-3 rounded-2xl bg-[#f8fafc] p-3.5 ring-1 ring-black/[0.05] transition-all duration-150 hover:bg-white hover:ring-black/[0.08] hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        {/* Link Info */}
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/[0.06] shadow-sm"
                          >
                            <Icon size={18} aria-hidden="true" style={{ color: link.color || '#0ea5e9' }} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-[#1d1d1f]">
                                {link.label}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  external ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'
                                }`}
                              >
                                {linkMeta.tone}
                              </span>
                            </div>
                            <p className="truncate text-xs text-[#475569]">
                              {link.url}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-1.5 border-t border-slate-200/50 pt-2 sm:border-t-0 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleMoveQuickLink(link.id, 'up')}
                            disabled={quickLinks.indexOf(link) === 0}
                            aria-label="ย้ายขึ้น"
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-black/[0.06] transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                          >
                            <ChevronUp size={14} aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveQuickLink(link.id, 'down')}
                            disabled={quickLinks.indexOf(link) === quickLinks.length - 1}
                            aria-label="ย้ายลง"
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-black/[0.06] transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                          >
                            <ChevronDown size={14} aria-hidden="true" />
                          </button>

                          <a
                            href={link.url}
                            target={external ? '_blank' : undefined}
                            rel={external ? 'noopener noreferrer' : undefined}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-black/[0.06] transition-colors hover:bg-slate-100"
                          >
                            <ExternalLink size={12} aria-hidden="true" />
                            เปิด
                          </a>

                          <button
                            type="button"
                            onClick={() => openEditQuickLink(link)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-black/[0.06] transition-colors hover:bg-slate-100"
                          >
                            <PencilLine size={12} aria-hidden="true" />
                            แก้ไข
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteQuickLink(link.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-xs font-semibold text-red-600 ring-1 ring-red-200/80 transition-colors hover:bg-red-100"
                          >
                            <Trash2 size={12} aria-hidden="true" />
                            ลบ
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── 4. Main Menu Management ────────────────────────── */}
            <div className="rounded-2xl bg-white p-5 sm:p-6 ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              {/* Header */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/60">
                    <Layers size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[17px] font-bold text-[#1d1d1f]">
                        จัดการการแสดงผลเมนูหลัก
                      </h2>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                        {mainMenuItems.filter((i) => i.enabled).length} / {mainMenuItems.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">
                      เลือกเปิดหรือซ่อนเมนูที่ต้องการแสดงในแถบเมนูข้าง (รวมถึงเมนูที่อยู่ระหว่างพัฒนา)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetMainMenu}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/[0.08] shadow-sm transition-all hover:bg-[#f5f5f7] active:scale-[0.98]"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>รีเซ็ตค่าเริ่มต้น</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                {mainMenuItems.map((item) => {
                  const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 ring-1 transition-all duration-150 ${
                        item.enabled
                          ? 'bg-[#f8fafc] ring-black/[0.05] hover:bg-white hover:ring-black/[0.08] hover:shadow-sm'
                          : 'bg-slate-50/50 ring-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/[0.06] shadow-sm text-slate-700">
                          <Icon size={18} aria-hidden="true" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#1d1d1f] truncate">
                              {item.name}
                            </span>

                            {item.required && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                เมนูจำเป็น
                              </span>
                            )}

                            {item.isWip && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/60">
                                {item.wipLabel || 'อยู่ระหว่างพัฒนา'}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[#475569] truncate">
                            {item.description || item.href}
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch with Status Badge */}
                      <div className="shrink-0 flex items-center gap-3">
                        {item.required ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                              จำเป็น
                            </span>
                            <div className="relative inline-flex h-7 w-12 shrink-0 cursor-not-allowed items-center rounded-full bg-[#0071e3]/40 p-0.5 opacity-70">
                              <span className="inline-block h-6 w-6 translate-x-5 transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                item.enabled
                                  ? 'bg-sky-50 text-[#0071e3] ring-1 ring-sky-200/60'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {item.enabled ? (
                                <>
                                  <Check size={12} className="shrink-0" />
                                  <span>แสดงในเมนู</span>
                                </>
                              ) : (
                                <span>ซ่อนไว้</span>
                              )}
                            </span>

                            <button
                              type="button"
                              role="switch"
                              aria-checked={item.enabled}
                              aria-label={`สลับการแสดงผล ${item.name}`}
                              onClick={() => handleToggleMainMenu(item.id)}
                              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-95 ${
                                item.enabled
                                  ? 'bg-[#0071e3] shadow-[0_2px_8px_rgba(0,113,227,0.35)]'
                                  : 'bg-slate-200 hover:bg-slate-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out ${
                                  item.enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── Quick Link Create/Edit Dialog ────────────────────────── */}
        <Dialog open={quickLinkDialogOpen} onOpenChange={setQuickLinkDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingQuickLinkId ? 'แก้ไขควิกลิ้งค์' : 'เพิ่มควิกลิ้งค์ใหม่'}
              </DialogTitle>
              <DialogDescription>
                กำหนดชื่อ URL ปลายทาง ไอคอน และสีเพื่อแสดงในแถบเมนูข้าง (Sidebar)
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitQuickLink} className="space-y-4">
              {/* Preview Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/[0.06] shadow-sm">
                      <PreviewIcon size={20} aria-hidden="true" style={{ color: qlColor || '#0ea5e9' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1d1d1f]">
                        {qlLabel.trim() || 'ตัวอย่างควิกลิ้งค์'}
                      </p>
                      <p className="truncate text-xs text-[#475569]">
                        {previewMeta.title}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-black/[0.06]">
                    {previewIconLabel}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">ชื่อปุ่มควิกลิ้งค์</label>
                <input
                  type="text"
                  value={qlLabel}
                  onChange={(e) => setQlLabel(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl bg-[#f8fafc] px-4 py-2.5 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  placeholder="เช่น Google Drive, ทะเบียนงาน"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">ลิงก์ปลายทาง (URL)</label>
                <input
                  type="text"
                  value={qlUrl}
                  onChange={(e) => setQlUrl(e.target.value)}
                  className="w-full rounded-xl bg-[#f8fafc] px-4 py-2.5 text-sm text-[#1d1d1f] ring-1 ring-black/[0.08] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  placeholder="https://... หรือ /camera"
                  required
                />
              </div>

              {/* Icon & Color Selection Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">เลือกไอคอน</label>
                  <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                    {QUICK_LINK_ICON_OPTIONS.map((opt) => {
                      const OptionIcon = QUICK_LINK_ICON_MAP[opt.key]
                      const isSelected = qlIcon === opt.key
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setQlIcon(opt.key)}
                          aria-pressed={isSelected}
                          title={opt.label}
                          className={`flex h-10 w-full items-center justify-center rounded-lg transition-all ${
                            isSelected
                              ? 'bg-white text-[#0071e3] shadow-sm ring-2 ring-[#0071e3]'
                              : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'
                          }`}
                        >
                          <OptionIcon size={16} aria-hidden="true" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">เลือกสีไอคอน</label>
                  <div className="flex h-[130px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={qlColor}
                        onChange={(e) => setQlColor(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                        aria-label="เลือกสีไอคอน"
                      />
                      <input
                        type="text"
                        value={qlColor}
                        onChange={(e) => setQlColor(e.target.value)}
                        className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                        placeholder="#0ea5e9"
                      />
                    </div>
                    <p className="text-[11px] text-[#475569]">
                      สีที่เลือกจะแสดงเป็นเฉดสีของไอคอนใน Sidebar
                    </p>
                  </div>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setQuickLinkDialogOpen(false)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-black/[0.08] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#0071e3] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0077ed] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                >
                  {editingQuickLinkId ? 'บันทึกการแก้ไข' : 'เพิ่มควิกลิ้งค์'}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}
