'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Clock,
  MapPin,
  Activity,
  AtSign,
  Hash,
  X,
  Palette,
  Bookmark,
} from 'lucide-react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert'
import { useAuth } from '@/hooks/useAuth'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import {
  QUICK_LINK_ICON_MAP,
  QUICK_LINK_ICON_OPTIONS,
  type QuickLink,
  type QuickLinkIconKey,
  isExternalUrl,
  parseQuickLinks,
  serializeQuickLinks,
} from '@/utils/quickLinks'
import {
  DEFAULT_MAIN_MENU_ITEMS,
  MAIN_MENU_ICON_MAP,
  MAIN_MENU_STORAGE_KEY,
  type MainMenuItemConfig,
  parseMainMenuConfig,
  serializeMainMenuConfig,
} from '@/utils/mainMenu'
import type { AuthUser } from '@/types'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function describeQuickLink(url: string) {
  const value = url.trim()
  if (!value) {
    return { tone: 'ยังไม่ระบุ', title: 'รอระบุปลายทาง', subtitle: 'ลิงก์นี้จะแสดงใน Sidebar' }
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
      return { tone: 'ภายนอก', title: value, subtitle: 'ลิงก์ภายนอก' }
    }
  }
  return { tone: 'ภายใน', title: 'เส้นทางภายในระบบ', subtitle: value }
}

const QUICK_LINK_COLOR_PRESETS = [
  '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#64748b',
]

// ─────────────────────────────────────────────────────────────
// Toggle Switch (Pill 34x18 — Apple-inspired)
// ─────────────────────────────────────────────────────────────

interface PillToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}

function PillToggle({ checked, onChange, disabled, label }: PillToggleProps) {
  if (disabled) {
    return (
      <div
        role="switch"
        aria-checked={true}
        aria-label={`${label} เปิดค้างไว้`}
        aria-disabled="true"
        className="relative h-[18px] w-[34px] shrink-0 cursor-not-allowed rounded-full bg-sky-100 p-[2px]"
      >
        <span
          className="absolute top-[2px] right-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.18)]"
          aria-hidden="true"
        />
      </div>
    )
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`สลับการแสดงผล ${label}`}
      onClick={onChange}
      className={[
        'relative h-[18px] w-[34px] shrink-0 cursor-pointer rounded-full border-0 appearance-none p-[2px] transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 active:scale-95',
        checked ? 'bg-sky-100 hover:bg-sky-200' : 'bg-slate-200 hover:bg-slate-300',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.16)] transition-all duration-200',
          checked ? 'left-[calc(100%-16px)]' : 'left-[2px]',
        ].join(' ')}
        aria-hidden="true"
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Section Card
// ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  iconRing: string
  title: string
  subtitle: string
  badge?: string
  action?: React.ReactNode
  children: React.ReactNode
}

function SectionCard({
  icon, iconBg, iconColor, iconRing, title, subtitle, badge, action, children,
}: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 sm:px-6 py-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconBg} ${iconColor} ring-1 ${iconRing}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[17px] font-bold tracking-tight text-[#1d1d1f] leading-snug">{title}</h2>
              {badge && (
                <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-snug text-[#6e6e73]">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Inset Text Field (iOS grouped-style)
// ─────────────────────────────────────────────────────────────

interface InsetFieldProps {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon: React.ReactNode
  trailing?: React.ReactNode
  required?: boolean
  autoComplete?: string
}

function InsetField({
  label, type = 'text', value, onChange, placeholder, icon, trailing, required, autoComplete,
}: InsetFieldProps) {
  return (
    <div>
      <label className="mb-1.5 ml-1 block text-[11px] font-bold tracking-wide uppercase text-[#6e6e73]">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={[
            'w-full rounded-2xl bg-[#f8fafc] py-3 text-sm font-medium text-[#1d1d1f] ring-1 ring-black/[0.06]',
            'transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]',
            trailing ? '!pr-12' : '!pr-4',
          ].join(' ')}
          style={{ paddingLeft: '2.75rem' }}
        />
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const { user: authUser, updateUser } = useAuth()
  const [user, setUser] = useState<AuthUser | null>(null)
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

  // Main Menu
  const [mainMenuItems, setMainMenuItems] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null)
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY)
    return parseMainMenuConfig(saved)
  })

  // Quick Links
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [quickLinkDialogOpen, setQuickLinkDialogOpen] = useState(false)
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null)
  const [qlLabel, setQlLabel] = useState('')
  const [qlUrl, setQlUrl] = useState('')
  const [qlIcon, setQlIcon] = useState<QuickLinkIconKey>('link')
  const [qlColor, setQlColor] = useState('#0ea5e9')

  const previewMeta = useMemo(() => describeQuickLink(qlUrl), [qlUrl])
  const PreviewIcon = QUICK_LINK_ICON_MAP[qlIcon]
  const previewIconLabel =
    QUICK_LINK_ICON_OPTIONS.find((option) => option.key === qlIcon)?.label ?? 'ลิงก์'

  const enabledMenuCount = useMemo(
    () => mainMenuItems.filter((i) => i.enabled).length,
    [mainMenuItems],
  )

  // ── Init ──────────────────────────────────────────────────────

  useEffect(() => {
    if (authUser) {
      setUser(authUser)
      setName(authUser.name || '')
      setEmail(authUser.email || '')
      setQuickLinks(parseQuickLinks(authUser.quick_links))
    }
  }, [authUser])

  // ── Password strength ─────────────────────────────────────────

  useEffect(() => {
    if (!newPassword) { setPasswordStrength(0); return }
    let strength = 0
    if (newPassword.length >= 8) strength++
    if (newPassword.length >= 12) strength++
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++
    if (/\d/.test(newPassword)) strength++
    if (/[^a-zA-Z0-9]/.test(newPassword)) strength++
    setPasswordStrength(strength)
  }, [newPassword])

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return { label: 'อ่อนแอ', color: 'bg-rose-500', text: 'text-rose-700' }
    if (passwordStrength === 2) return { label: 'ปานกลาง', color: 'bg-amber-500', text: 'text-amber-700' }
    if (passwordStrength === 3) return { label: 'ดี', color: 'bg-lime-500', text: 'text-lime-700' }
    if (passwordStrength === 4) return { label: 'แข็งแรง', color: 'bg-emerald-500', text: 'text-emerald-700' }
    return { label: 'ปลอดภัยสูง', color: 'bg-teal-500', text: 'text-teal-700' }
  }

  // ── Handlers: Profile ─────────────────────────────────────────

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSavingProfile(true)
    try {
      const response = await fetchWithAuth('/api/v1/profile/me', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await response.json()
      if (response.ok) {
        const updatedUser: AuthUser = { ...user, name, email }
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
    if (!user) { showError('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่'); router.push('/login'); return }

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

  // ── Handlers: Main Menu ───────────────────────────────────────

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

  // ── Handlers: Quick Links ─────────────────────────────────────

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
    if (!user) return false
    try {
      const raw = serializeQuickLinks(nextLinks)
      const response = await fetchWithAuth('/api/v1/profile/quick-links', {
        method: 'POST',
        body: JSON.stringify({ quick_links: raw }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: '' }))
        showError('เกิดข้อผิดพลาด', (data as any).detail || 'ไม่สามารถบันทึก Quick Links ได้')
        return false
      }
      const updatedUser: AuthUser = { ...user, quick_links: raw }
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
    if (!isValid) { showToast('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ /', 'warning'); return }
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

  // ── Loading ───────────────────────────────────────────────────

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
        </div>
      </DashboardLayout>
    )
  }

  const strengthMeta = getStrengthLabel()

  // ── Render ────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-2 sm:px-3 md:px-4 lg:px-6">

        {/* ══════════════════════════════════════════════════
            SECTION 1 — PROFILE HERO
            ══════════════════════════════════════════════════ */}
        <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(15,23,42,0.07)]">
          {/* Banner */}
          <div className="relative h-40 sm:h-44 bg-gradient-to-br from-[#0071e3] via-[#5856d6] to-[#af52de]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.35),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.14),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_40%)]" />
          </div>

          {/* Identity row */}
          <div className="px-5 sm:px-8 pb-7">
            <div className="flex flex-col items-center gap-5 pt-0 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
              {/* Avatar */}
              <div className="relative -mt-14 flex-shrink-0 sm:-mt-10">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#0071e3] via-[#5856d6] to-[#af52de] text-4xl font-black text-white ring-[5px] ring-white shadow-[0_12px_32px_rgba(0,113,227,0.35)] sm:h-24 sm:w-24 sm:text-3xl">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button
                  type="button"
                  className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] hover:scale-105 active:scale-95"
                  aria-label="เปลี่ยนรูปโปรไฟล์"
                  title="เปลี่ยนรูปโปรไฟล์"
                >
                  <Camera size={14} aria-hidden="true" />
                </button>
              </div>

              {/* Name + meta */}
              <div className="min-w-0 flex-1 sm:pb-1">
                <div className="mb-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-black tracking-[-0.03em] text-[#1d1d1f] sm:text-[28px] leading-tight">
                    {user.name || 'ผู้ใช้งาน'}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${
                      user.role === 'admin'
                        ? 'bg-purple-50 text-purple-700 ring-purple-200'
                        : 'bg-sky-50 text-sky-700 ring-sky-200'
                    }`}
                  >
                    {user.role === 'admin' ? (
                      <><ShieldCheck size={12} aria-hidden="true" />ผู้ดูแลระบบ</>
                    ) : (
                      <><User size={12} aria-hidden="true" />ผู้ใช้งาน</>
                    )}
                  </span>
                </div>

                {/* Contact info inline */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#475569]">
                    <AtSign size={12} className="text-slate-400" aria-hidden="true" />
                    {user.email || 'ไม่ได้ตั้งค่าอีเมล'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#475569]">
                    <Hash size={12} className="text-slate-400" aria-hidden="true" />
                    ID #{user.id}
                  </span>
                </div>

                {/* Status chips */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                    ใช้งานปกติ
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                    <Shield size={12} aria-hidden="true" />
                    รหัสผ่าน
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                    <Layers size={12} aria-hidden="true" />
                    {enabledMenuCount}/{mainMenuItems.length} เมนู
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
                    <Link2 size={12} aria-hidden="true" />
                    {quickLinks.length} ลิงก์
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            SECTION 2 — PERSONAL INFO + SECURITY (2-col grid)
            ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* 2.1 Personal Info */}
          <SectionCard
            icon={<User size={20} aria-hidden="true" />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            iconRing="ring-emerald-200/60"
            title="ข้อมูลส่วนตัว"
            subtitle="อัปเดตชื่อและอีเมลที่ใช้แสดงในระบบ"
          >
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <InsetField
                label="ชื่อที่แสดง"
                value={name}
                onChange={setName}
                placeholder="เช่น สมชาย ใจดี"
                icon={<User size={16} aria-hidden="true" />}
                required
              />
              <InsetField
                label="อีเมลสำหรับเข้าสู่ระบบ"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="name@company.com"
                icon={<Mail size={16} aria-hidden="true" />}
                required
                autoComplete="email"
              />
              <div className="flex items-start gap-2.5 rounded-2xl bg-sky-50/70 p-3.5 text-[11.5px] text-sky-900 ring-1 ring-sky-200/60 leading-relaxed">
                <Info size={14} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
                <p><strong className="font-bold">คำแนะนำ:</strong> เปลี่ยนอีเมล = ต้องใช้อีเมลใหม่เข้าสู่ระบบครั้งหน้า</p>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_3px_12px_rgba(0,113,227,0.32)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  {isSavingProfile ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                  ) : (
                    <Check size={14} aria-hidden="true" />
                  )}
                  {isSavingProfile ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* 2.2 Password & Security */}
          <SectionCard
            icon={<Lock size={20} aria-hidden="true" />}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
            iconRing="ring-rose-200/60"
            title="รหัสผ่าน &amp; ความปลอดภัย"
            subtitle="เปลี่ยนบ่อยๆ เพื่อปกป้องบัญชีของคุณ"
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <InsetField
                label="รหัสผ่านปัจจุบัน"
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={setOldPassword}
                placeholder="กรอกรหัสผ่านเดิม"
                icon={<Lock size={16} aria-hidden="true" />}
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showOldPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showOldPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                }
              />
              <InsetField
                label="รหัสผ่านใหม่"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={setNewPassword}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                icon={<KeyRound size={16} aria-hidden="true" />}
                autoComplete="new-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showNewPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showNewPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                }
              />

              {/* Strength meter */}
              {newPassword && (
                <div className="-mt-1 rounded-2xl bg-[#f8fafc] p-3 ring-1 ring-black/[0.04]">
                  <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                    <span className="text-[#6e6e73]">ระดับความปลอดภัย</span>
                    <span className={`font-bold ${strengthMeta.text}`}>{strengthMeta.label}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-300 ${strengthMeta.color}`}
                      style={{ width: `${Math.min(100, (passwordStrength / 5) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-[#6e6e73]">
                    <span className={newPassword.length >= 8 ? 'text-emerald-600 font-semibold' : ''}>
                      {newPassword.length >= 8 ? '✓' : '○'} อย่างน้อย 8 ตัวอักษร
                    </span>
                    <span className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-emerald-600 font-semibold' : ''}>
                      {/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? '✓' : '○'} พิมพ์เล็ก+ใหญ่
                    </span>
                    <span className={newPassword.length >= 12 ? 'text-emerald-600 font-semibold' : ''}>
                      {newPassword.length >= 12 ? '✓' : '○'} 12 ตัวอักษรขึ้นไป
                    </span>
                    <span className={/\d/.test(newPassword) ? 'text-emerald-600 font-semibold' : ''}>
                      {/\d/.test(newPassword) ? '✓' : '○'} มีตัวเลข
                    </span>
                    <span className={/[^a-zA-Z0-9]/.test(newPassword) ? 'text-emerald-600 font-semibold col-span-2' : 'col-span-2'}>
                      {/[^a-zA-Z0-9]/.test(newPassword) ? '✓' : '○'} มีอักขระพิเศษ (!@#$%)
                    </span>
                  </div>
                </div>
              )}

              <InsetField
                label="ยืนยันรหัสผ่านใหม่"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                icon={<KeyRound size={16} aria-hidden="true" />}
                autoComplete="new-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                }
              />

              {/* Match indicator */}
              {confirmPassword && (
                <div className={`-mt-1 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[11.5px] font-semibold ring-1 ${
                  newPassword === confirmPassword
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-rose-50 text-rose-700 ring-rose-200'
                }`}>
                  {newPassword === confirmPassword ? (
                    <><Check size={13} /> รหัสผ่านยืนยันตรงกัน</>
                  ) : (
                    <><X size={13} /> รหัสผ่านยืนยันยังไม่ตรงกัน</>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_3px_12px_rgba(0,113,227,0.32)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  {isChangingPassword ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                  ) : (
                    <Save size={14} aria-hidden="true" />
                  )}
                  {isChangingPassword ? 'กำลังบันทึก…' : 'อัปเดตรหัสผ่าน'}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>

        {/* ══════════════════════════════════════════════════
            SECTION 3 — MAIN MENU MANAGEMENT (REDESIGNED)
            ══════════════════════════════════════════════════ */}
        <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.05)]">
          {/* Header bar */}
          <div className="relative px-5 sm:px-7 lg:px-8 py-5 sm:py-6 border-b border-slate-100 bg-gradient-to-b from-indigo-50/40 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                {/* Icon */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_6px_16px_rgba(99,102,241,0.28)]">
                  <Layers size={20} strokeWidth={2.2} aria-hidden="true" />
                </div>
                {/* Title block */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-[18px] sm:text-[19px] font-black tracking-tight text-[#1d1d1f] leading-snug">
                      จัดการเมนูหลัก
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-indigo-700 ring-1 ring-indigo-200 shadow-[0_1px_2px_rgba(99,102,241,0.12)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                      {enabledMenuCount} จาก {mainMenuItems.length}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#6e6e73] leading-snug">
                    เปิด / ปิด การแสดงผลเมนูในแถบข้าง ตามที่คุณต้องการใช้งาน
                  </p>
                </div>
              </div>

              {/* Actions + status */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                {/* Mini progress bar */}
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200/70">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                      style={{ width: `${(enabledMenuCount / Math.max(1, mainMenuItems.length)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] font-extrabold text-slate-600 tabular-nums">
                    {Math.round((enabledMenuCount / Math.max(1, mainMenuItems.length)) * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetMainMenu}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11.5px] font-bold text-[#1d1d1f] ring-1 ring-black/[0.08] shadow-sm transition-all duration-150 hover:bg-[#f5f5f7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] active:scale-[0.98]"
                >
                  <RotateCcw size={12.5} aria-hidden="true" />
                  รีเซ็ตค่าเริ่มต้น
                </button>
              </div>
            </div>
          </div>

          {/* Grid of menu cards */}
          <div className="px-5 sm:px-7 lg:px-8 py-5 sm:py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {mainMenuItems.map((item) => {
                const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles
                const isOn = item.enabled
                const isRequired = item.required

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => !isRequired && handleToggleMainMenu(item.id)}
                    disabled={isRequired}
                    aria-pressed={isOn}
                    aria-label={`${isOn ? 'ซ่อน' : 'เปิด'} เมนู ${item.name}`}
                    className={[
                      'group relative text-left overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-200',
                      'ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2',
                      'active:scale-[0.985]',
                      isRequired ? 'cursor-default' : 'cursor-pointer',
                      isOn
                        ? 'bg-gradient-to-br from-white to-indigo-50/30 ring-indigo-200/60 shadow-[0_2px_8px_rgba(99,102,241,0.08)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.12)] hover:ring-indigo-300'
                        : 'bg-[#fafafa] ring-black/[0.05] hover:bg-white hover:ring-black/[0.08] hover:shadow-[0_2px_10px_rgba(15,23,42,0.05)]',
                    ].join(' ')}
                  >
                    {/* Top row — icon + toggle */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      {/* Icon tile */}
                      <div
                        className={[
                          'flex h-12 w-12 items-center justify-center rounded-[18px] ring-1 transition-all duration-300',
                          isOn
                            ? 'bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-500 text-white ring-transparent shadow-[0_6px_14px_rgba(99,102,241,0.30)] scale-100'
                            : 'bg-white text-slate-400 ring-black/[0.05] group-hover:text-slate-600',
                        ].join(' ')}
                      >
                        <Icon size={21} strokeWidth={isOn ? 2.2 : 2} aria-hidden="true" />
                      </div>

                      {/* Status + toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={[
                            'hidden sm:inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[9.5px] font-extrabold ring-1 transition-all',
                            isOn
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-100 text-slate-500 ring-slate-200',
                          ].join(' ')}
                        >
                          {isOn ? 'แสดง' : 'ซ่อน'}
                        </span>
                        <PillToggle
                          checked={isOn}
                          onChange={() => !isRequired && handleToggleMainMenu(item.id)}
                          disabled={isRequired}
                          label={item.name}
                        />
                      </div>
                    </div>

                    {/* Title + description */}
                    <div className="min-h-[56px]">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h3
                          className={[
                            'text-[14.5px] font-extrabold tracking-tight leading-snug transition-colors',
                            isOn ? 'text-[#1d1d1f]' : 'text-[#6e6e73]',
                          ].join(' ')}
                        >
                          {item.name}
                        </h3>
                        {item.isWip && (
                          <span className="inline-flex items-center rounded-full bg-sky-50 px-1.5 py-[1px] text-[9px] font-extrabold text-sky-700 ring-1 ring-sky-200">
                            {item.wipLabel || 'กำลังพัฒนา'}
                          </span>
                        )}
                      </div>
                      <p
                        className={[
                          'text-[11.5px] leading-relaxed transition-colors line-clamp-2',
                          isOn ? 'text-[#6e6e73]' : 'text-[#a1a1aa]',
                        ].join(' ')}
                      >
                        {item.description || item.href}
                      </p>
                    </div>

                    {/* Bottom status row */}
                    <div className="mt-3 pt-3 border-t border-dashed border-black/[0.06] flex items-center justify-between">
                      {isRequired ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-emerald-700">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                            <Check size={9.5} strokeWidth={3} aria-hidden="true" />
                          </span>
                          เมนูเริ่มต้น
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#6e6e73]">
                          <span
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                              isOn ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            aria-hidden="true"
                          />
                          {isOn ? 'กำลังใช้งานอยู่' : 'ยังไม่ได้เปิดใช้งาน'}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        /{item.href.replace(/^\//, '')}
                      </span>
                    </div>

                    {/* Corner decoration (gradient when on) */}
                    {isOn && (
                      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-200/40 to-violet-200/30 blur-2xl opacity-60" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer hint */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/60 px-4 py-3 ring-1 ring-slate-200/50">
              <div className="flex items-center gap-2 text-[11.5px] text-[#6e6e73]">
                <Info size={13} className="text-slate-400" aria-hidden="true" />
                <span>
                  <strong className="font-bold text-[#1d1d1f]">เคล็ดลับ:</strong> แตะการ์ดทั้งใบ
                  เพื่อสลับเปิด / ปิดได้เลย หรือใช้ปุ่มสลับที่มุมขวาบน
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> {enabledMenuCount} เปิด
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> {mainMenuItems.length - enabledMenuCount} ซ่อน
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            SECTION 4 — QUICK LINKS MANAGEMENT
            ══════════════════════════════════════════════════ */}
        <SectionCard
          icon={<Link2 size={20} aria-hidden="true" />}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          iconRing="ring-sky-200/60"
          title="ควิกลิ้งค์"
          subtitle="ทางลัดเข้าถึงเว็บไซต์หรือหน้างานสำคัญ แสดงในแถบเมนูข้าง"
          badge={`${quickLinks.length} รายการ`}
          action={
            <button
              type="button"
              onClick={openCreateQuickLink}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-1.5 text-[11.5px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_3px_12px_rgba(0,113,227,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 active:scale-[0.98]"
            >
              <Plus size={12} aria-hidden="true" />
              เพิ่มลิงก์
            </button>
          }
        >
          {quickLinks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-black/[0.06]">
                <Link2 size={20} aria-hidden="true" />
              </div>
              <h3 className="text-[15px] font-bold text-[#1d1d1f]">ยังไม่มีควิกลิ้งค์</h3>
              <p className="mx-auto mt-1 max-w-xs text-[12px] text-[#6e6e73] leading-relaxed">
                เพิ่มลิงก์ที่ใช้งานบ่อย เช่น Email, ระบบภายใน หรือเว็บไซต์สำคัญ
                <br />เพื่อเข้าถึงได้รวดเร็วจากแถบเมนูข้าง
              </p>
              <button
                type="button"
                onClick={openCreateQuickLink}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-5 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#0077ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
              >
                <Plus size={12} aria-hidden="true" />
                สร้างลิงก์แรก
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {quickLinks.map((link) => {
                const Icon = QUICK_LINK_ICON_MAP[link.icon]
                const linkMeta = describeQuickLink(link.url)
                const external = isExternalUrl(link.url)
                const index = quickLinks.indexOf(link)
                return (
                  <div
                    key={link.id}
                    className="group flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-transparent transition-all duration-150 hover:bg-[#f8fafc] hover:ring-black/[0.05] sm:p-3"
                  >
                    {/* Color dot + icon */}
                    <div className="relative shrink-0">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                      >
                        <Icon size={17} aria-hidden="true" style={{ color: link.color || '#0ea5e9' }} />
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: link.color || '#0ea5e9' }}
                        aria-hidden="true"
                      />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-[13.5px] font-bold tracking-tight text-[#1d1d1f]">
                          {link.label}
                        </span>
                        <span className={`rounded-full px-1.5 py-[1px] text-[9.5px] font-bold ring-1 ${
                          external
                            ? 'bg-sky-50 text-sky-700 ring-sky-200'
                            : 'bg-violet-50 text-violet-700 ring-violet-200'
                        }`}>
                          {linkMeta.tone}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#6e6e73] leading-snug">
                        {link.url}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveQuickLink(link.id, 'up')}
                        disabled={index === 0}
                        aria-label="ย้ายขึ้น"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      >
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuickLink(link.id, 'down')}
                        disabled={index === quickLinks.length - 1}
                        aria-label="ย้ายลง"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      <a
                        href={link.url}
                        target={external ? '_blank' : undefined}
                        rel={external ? 'noopener noreferrer' : undefined}
                        className="hidden sm:inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10.5px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label="เปิดลิงก์"
                      >
                        <ExternalLink size={11} aria-hidden="true" />
                        เปิด
                      </a>
                      <button
                        type="button"
                        onClick={() => openEditQuickLink(link)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10.5px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label="แก้ไขลิงก์"
                      >
                        <PencilLine size={12} aria-hidden="true" />
                        <span className="hidden sm:inline">แก้ไข</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuickLink(link.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10.5px] font-bold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        aria-label="ลบลิงก์"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        <span className="hidden sm:inline">ลบ</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Footer info strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/50 px-5 sm:px-6 py-3.5 ring-1 ring-black/[0.04] backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#6e6e73]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} className="text-slate-400" />
              ART Workspace v1.0
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Activity size={12} className="text-slate-400" />
              Apple-inspired UI
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} className="text-slate-400" />
              การตั้งค่าถูกซิงค์กับทุกอุปกรณ์
            </span>
          </div>
          <span className="text-[10.5px] text-slate-400">
            บันทึกอัตโนมัติ · ข้อมูลปลอดภัยด้วย Argon2 + HTTPS
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          QUICK LINK DIALOG (CREATE / EDIT)
          ══════════════════════════════════════════════════ */}
      <Dialog open={quickLinkDialogOpen} onOpenChange={setQuickLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuickLinkId ? 'แก้ไขควิกลิ้งค์' : 'สร้างควิกลิ้งค์ใหม่'}</DialogTitle>
            <DialogDescription>
              {editingQuickLinkId ? 'ปรับแต่งชื่อ ลิงก์ ไอคอน และสีของลิงก์นี้' : 'เพิ่มทางลัดสำหรับเว็บไซต์หรือหน้าที่คุณใช้งานบ่อย'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitQuickLink}>
            <DialogBody className="space-y-5">
              {/* Preview card */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 ring-1 ring-black/[0.04]">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">ตัวอย่างการแสดงผล</div>
                <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/[0.06] shadow-sm">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[14px]"
                    style={{ backgroundColor: `${qlColor}15` }}
                  >
                    <PreviewIcon size={17} aria-hidden="true" style={{ color: qlColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold tracking-tight text-[#1d1d1f]">
                      {qlLabel || 'ชื่อลิงก์ (เช่น Gmail)'}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#6e6e73]">
                      {previewMeta.title}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                    previewMeta.tone === 'ภายนอก'
                      ? 'bg-sky-50 text-sky-700 ring-sky-200'
                      : previewMeta.tone === 'ภายใน'
                        ? 'bg-violet-50 text-violet-700 ring-violet-200'
                        : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}>
                    {previewMeta.tone}
                  </span>
                </div>
              </div>

              {/* Label + URL */}
              <div className="space-y-3.5">
                <InsetField
                  label="ชื่อลิงก์"
                  value={qlLabel}
                  onChange={setQlLabel}
                  placeholder="เช่น Gmail, งาน IT, Dashboard ระบบสารบัญ"
                  icon={<Bookmark size={16} aria-hidden="true" />}
                  required
                />
                <InsetField
                  label="URL / ที่อยู่ลิงก์"
                  value={qlUrl}
                  onChange={setQlUrl}
                  placeholder="https://mail.google.com หรือ /dashboard"
                  icon={<Link2 size={16} aria-hidden="true" />}
                  required
                />
              </div>

              {/* Icon Picker */}
              <div>
                <div className="mb-2 ml-1 flex items-center justify-between">
                  <label className="text-[11px] font-bold tracking-wide uppercase text-[#6e6e73]">
                    ไอคอน · <span className="text-[#0071e3] font-normal normal-case tracking-normal">{previewIconLabel}</span>
                  </label>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-2.5 ring-1 ring-black/[0.04]">
                  <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                    {QUICK_LINK_ICON_OPTIONS.map((option) => {
                      const OptIcon = QUICK_LINK_ICON_MAP[option.key]
                      const active = qlIcon === option.key
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setQlIcon(option.key)}
                          title={option.label}
                          aria-label={option.label}
                          className={[
                            'relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
                            active
                              ? 'bg-white shadow-sm ring-2 ring-[#0071e3]'
                              : 'bg-white/50 hover:bg-white ring-1 ring-black/[0.04] hover:ring-black/[0.08]',
                          ].join(' ')}
                        >
                          <OptIcon
                            size={15}
                            aria-hidden="true"
                            className={active ? 'text-[#0071e3]' : 'text-slate-500'}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <div className="mb-2 ml-1 flex items-center justify-between">
                  <label className="text-[11px] font-bold tracking-wide uppercase text-[#6e6e73]">
                    สีของไอคอน
                  </label>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-lg ring-1 ring-black/10"
                      style={{ backgroundColor: qlColor }}
                      aria-hidden="true"
                    />
                    <span className="text-[10.5px] font-mono text-[#6e6e73] uppercase">{qlColor}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-3 ring-1 ring-black/[0.04]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_LINK_COLOR_PRESETS.map((color) => {
                      const active = qlColor === color
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setQlColor(color)}
                          aria-label={`สี ${color}`}
                          className={[
                            'h-8 w-8 rounded-xl transition-all duration-150 ring-offset-2',
                            active ? 'ring-2 ring-[#1d1d1f] scale-110 shadow-md' : 'ring-1 ring-black/10 hover:scale-105',
                          ].join(' ')}
                          style={{ backgroundColor: color }}
                        />
                      )
                    })}
                    <label className="group relative flex h-8 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-white text-slate-400 ring-1 ring-black/10 transition-all hover:text-slate-600 hover:scale-105 w-16">
                      <Palette size={14} aria-hidden="true" />
                      <span className="ml-1 text-[10px] font-bold">อื่นๆ</span>
                      <input
                        type="color"
                        value={qlColor}
                        onChange={(e) => setQlColor(e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="เลือกสีอื่นๆ"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Validation info */}
              <div className="flex items-start gap-2 rounded-2xl bg-slate-50/80 p-3 text-[11px] text-[#6e6e73] ring-1 ring-slate-200/60 leading-relaxed">
                <Info size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <div>
                  <strong className="font-bold text-[#475569]">รูปแบบที่ยอมรับ:</strong>
                  <ul className="mt-1 ml-4 space-y-0.5 list-disc">
                    <li>ลิงก์ภายนอก: <code className="px-1 py-0.5 rounded bg-white text-[#0071e3] text-[10px] font-mono">https://...</code> หรือ <code className="px-1 py-0.5 rounded bg-white text-[#0071e3] text-[10px] font-mono">http://...</code></li>
                    <li>ลิงก์ภายใน: <code className="px-1 py-0.5 rounded bg-white text-[#0071e3] text-[10px] font-mono">/dashboard</code> หรือ <code className="px-1 py-0.5 rounded bg-white text-[#0071e3] text-[10px] font-mono">/camera</code></li>
                  </ul>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setQuickLinkDialogOpen(false)}
                className="w-full rounded-full bg-[#f5f5f7] px-5 py-2.5 text-[13px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-[0.98] sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0071e3] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_3px_12px_rgba(0,113,227,0.32)] active:scale-[0.98] sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2"
              >
                <Check size={14} aria-hidden="true" />
                {editingQuickLinkId ? 'บันทึกการแก้ไข' : 'สร้างลิงก์'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
