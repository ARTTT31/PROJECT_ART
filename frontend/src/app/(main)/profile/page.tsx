'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
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
  KeyRound,
  Mail,
  AtSign,
  Palette,
  Bookmark,
  LayoutGrid,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Camera,
  Download,
  Loader2,
} from 'lucide-react'
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert'
import { canAccessPage } from '@/utils/accessiblePages'
import { useAuth } from '@/hooks/useAuth'
import UserManagement from '@/components/Admin/UserManagement'
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
  parseMainMenuConfig,
  serializeMainMenuConfig,
  MAIN_MENU_STORAGE_KEY,
  MAIN_MENU_ICON_MAP,
  type MainMenuItemConfig,
} from '@/utils/mainMenu'
import type { AuthUser } from '@/types'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Extract readable error message from API response body, handling Pydantic arrays */
function apiMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] }
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined
      return field ? `${field}: ${first.msg}` : first.msg
    }
  }
  return fallback
}

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
  '#0066cc', '#5856d6', '#af52de', '#ff2d55', '#ff3b30',
  '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#30b0c7',
  '#8e8e93',
]

// ─────────────────────────────────────────────────────────────
// Section Card Component
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
  icon,
  iconBg,
  iconColor,
  iconRing,
  title,
  subtitle,
  badge,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-[18px] bg-white border border-black/[0.06] shadow-sm transition-all duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] bg-[#fafafc] px-5 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${iconBg} ${iconColor} ring-1 ${iconRing}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[#1d1d1f] leading-snug">
                {title}
              </h2>
              {badge && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#6e6e73] ring-1 ring-black/[0.06] shadow-2xs">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-[12px] leading-snug text-[#6e6e73] truncate max-w-xs sm:max-w-md">
              {subtitle}
            </p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Inset Text Field (iOS Grouped Style)
// ─────────────────────────────────────────────────────────────

interface InsetFieldProps {
  id?: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon: React.ReactNode
  trailing?: React.ReactNode
  required?: boolean
  autoComplete?: string
  readOnly?: boolean
  hint?: string
}

function InsetField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  trailing,
  required,
  autoComplete,
  readOnly,
  hint,
}: InsetFieldProps) {
  const inputId = id || `field-${label.replace(/[^a-zA-Z0-9ก-๙]/g, '-').toLowerCase()}`

  return (
    <div>
      <div className="mb-1.5 ml-1 flex items-center justify-between">
        <label htmlFor={inputId} className="block text-[12px] font-bold text-[#475569] cursor-pointer">
          {label}
        </label>
        {hint && (
          <span className="text-[11px] font-medium text-[#86868b]">{hint}</span>
        )}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]">
          {icon}
        </span>
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          readOnly={readOnly}
          className={[
            'w-full rounded-[14px] py-3 text-[16px] sm:text-[14px] font-medium text-[#1d1d1f] placeholder:text-[#86868b] transition-all duration-150',
            readOnly
              ? 'bg-[#f2f2f7]/60 cursor-default select-text'
              : 'bg-[#f5f5f7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc] focus:shadow-sm',
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
// Main Profile Page Component
// ─────────────────────────────────────────────────────────────

type TabKey = 'profile' | 'preferences' | 'admin'

export default function ProfilePage() {
  const router = useRouter()
  const { user: authUser, updateUser, logout } = useAuth()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  // Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Personal Info Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Password & Security Form
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Data & privacy (PDPA): export + self-delete
  const [isExporting, setIsExporting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  // Quick Links
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [quickLinkDialogOpen, setQuickLinkDialogOpen] = useState(false)
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null)
  const [qlLabel, setQlLabel] = useState('')
  const [qlUrl, setQlUrl] = useState('')
  const [qlIcon, setQlIcon] = useState<QuickLinkIconKey>('link')
  const [qlColor, setQlColor] = useState('#0066cc')

  // Main Menu Config
  const [mainMenuConfig, setMainMenuConfig] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null)
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY)
    return parseMainMenuConfig(saved)
  })

  const previewMeta = useMemo(() => describeQuickLink(qlUrl), [qlUrl])
  const PreviewIcon = QUICK_LINK_ICON_MAP[qlIcon]
  const previewIconLabel =
    QUICK_LINK_ICON_OPTIONS.find((option) => option.key === qlIcon)?.label ?? 'ลิงก์'

  const isAdmin = user?.role === 'admin'

  // Sync tab with URL hash and listen to browser popstate / hashchange
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash === 'preferences' || hash === 'profile') {
        setActiveTab(hash as TabKey)
      } else if (hash === 'admin') {
        if (authUser?.role === 'admin') {
          setActiveTab('admin')
        } else {
          setActiveTab('profile')
        }
      }
    }

    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [authUser])

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`)
    }
  }

  // ── Main Menu Handlers ────────────────────────────────────────

  const saveMainMenu = (items: MainMenuItemConfig[]) => {
    const serialized = serializeMainMenuConfig(items)
    localStorage.setItem(MAIN_MENU_STORAGE_KEY, serialized)
    window.dispatchEvent(new Event('art-main-menu-updated'))
    setMainMenuConfig(items)
  }

  const toggleMainMenuItem = (id: string) => {
    const updated = mainMenuConfig.map((item) =>
      item.id === id && !item.required ? { ...item, enabled: !item.enabled } : item
    )
    saveMainMenu(updated)
  }

  const moveMainMenuItem = (id: string, dir: 'up' | 'down') => {
    const idx = mainMenuConfig.findIndex((item) => item.id === id)
    if (idx === -1) return
    const newList = [...mainMenuConfig]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= newList.length) return
    ;[newList[idx], newList[target]] = [newList[target], newList[idx]]
    saveMainMenu(newList)
  }

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
    if (passwordStrength <= 1) return { label: 'อ่อนแอ', color: 'bg-rose-500', text: 'text-rose-700' }
    if (passwordStrength === 2) return { label: 'ปานกลาง', color: 'bg-amber-500', text: 'text-amber-700' }
    if (passwordStrength === 3) return { label: 'ดี', color: 'bg-lime-500', text: 'text-lime-700' }
    if (passwordStrength === 4) return { label: 'แข็งแรง', color: 'bg-emerald-500', text: 'text-emerald-700' }
    return { label: 'ปลอดภัยสูง', color: 'bg-teal-500', text: 'text-teal-700' }
  }

  // ── Handlers: Avatar Upload ───────────────────────────────────

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate size (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      showToast('ขนาดไฟล์รูปภาพห้ามเกิน 1MB', 'warning')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate mime type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      showToast('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, GIF เท่านั้น', 'warning')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setIsUploadingAvatar(true)
    try {
      const response = await fetchWithAuth('/api/v1/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (response.ok) {
        // Re-fetch profile to get updated base64 avatar
        const profRes = await fetchWithAuth('/api/v1/profile/me')
        if (profRes.ok) {
          const fresh = await profRes.json()
          const updatedUser: AuthUser = { ...user, avatar: fresh.avatar }
          localStorage.setItem('user', JSON.stringify(updatedUser))
          setUser(updatedUser)
          updateUser({ avatar: fresh.avatar })
          window.dispatchEvent(new Event('user-profile-updated'))
        }
        showSuccess('สำเร็จ', data.message || 'อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว!')
      } else {
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'ไม่สามารถอัปโหลดรูปภาพได้'))
      }
    } catch (err) {
      console.error('Avatar upload error:', err)
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์'))
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
    if (!confirmPassword) { showToast('กรุณากรอกยืนยันรหัสผ่านใหม่', 'warning'); return }
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
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'))
      }
    } catch (error) {
      console.error('Password change error:', error)
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    } finally {
      setIsChangingPassword(false)
    }
  }

  // ── Handlers: data & privacy (PDPA) ───────────────────────────

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await fetchWithAuth('/api/v1/profile/export')
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        showError('ส่งออกข้อมูลไม่สำเร็จ', apiMessage(body, 'กรุณาลองใหม่อีกครั้ง'))
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'art-workspace-export.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showSuccess('ดาวน์โหลดข้อมูลแล้ว', 'ไฟล์สำเนาข้อมูลของคุณถูกบันทึกไว้ในเครื่อง')
    } catch (error) {
      console.error('Export data error:', error)
      showError('ส่งออกข้อมูลไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showToast('กรุณากรอกรหัสผ่านเพื่อยืนยัน', 'warning')
      return
    }
    const result = await showDeleteConfirm(
      'ลบบัญชีของคุณ?',
      'บัญชีจะถูกย้ายไปถังขยะและใช้งานไม่ได้ทันที ผู้ดูแลระบบสามารถกู้คืนได้ภายใน 30 วัน จากนั้นจะถูกลบถาวร'
    )
    if (!result.isConfirmed) return

    setIsDeletingAccount(true)
    try {
      const response = await fetchWithAuth('/api/v1/profile/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        showError('ลบบัญชีไม่สำเร็จ', apiMessage(body, 'กรุณาตรวจสอบรหัสผ่านแล้วลองใหม่'))
        return
      }
      await logout()
      router.replace('/login')
    } catch (error) {
      console.error('Delete account error:', error)
      showError('ลบบัญชีไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  // ── Handlers: Quick Links ─────────────────────────────────────

  const openCreateQuickLink = () => {
    setEditingQuickLinkId(null)
    setQlLabel('')
    setQlUrl('')
    setQlIcon('link')
    setQlColor('#0066cc')
    setQuickLinkDialogOpen(true)
  }

  const openEditQuickLink = (link: QuickLink) => {
    setEditingQuickLinkId(link.id)
    setQlLabel(link.label)
    setQlUrl(link.url)
    setQlIcon(link.icon)
    setQlColor(link.color || '#0066cc')
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
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'ไม่สามารถบันทึก Quick Links ได้'))
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
    const label = qlLabel.trim()
    const url = qlUrl.trim()
    if (!label) { showToast('กรุณากรอกชื่อควิกลิ้งค์', 'warning'); return }
    if (!url) { showToast('กรุณากรอกลิงก์ปลายทาง', 'warning'); return }
    const isValid = isExternalUrl(url) || url.startsWith('/')
    if (!isValid) { showToast('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ /', 'warning'); return }
    const next: QuickLink = {
      id: editingQuickLinkId ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      label,
      url,
      icon: qlIcon,
      color: qlColor || undefined,
    }
    const nextLinks = editingQuickLinkId
      ? quickLinks.map((l) => (l.id === editingQuickLinkId ? next : l))
      : [...quickLinks, next]
    const ok = await persistQuickLinks(nextLinks)
    if (ok) {
      setQuickLinkDialogOpen(false)
      showSuccess('สำเร็จ', 'บันทึก Quick Links สำเร็จแล้ว')
    }
  }

  const handleMoveQuickLink = async (id: string, direction: 'up' | 'down') => {
    const idx = quickLinks.findIndex((l) => l.id === id)
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

  // ── Loading State ─────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0066cc]" />
          <span className="text-[13px] font-medium text-[#6e6e73]">กำลังโหลดข้อมูลโปรไฟล์…</span>
        </div>
      </div>
    )
  }

  const strengthMeta = getStrengthLabel()

  // One shared rule for the whole app — see utils/accessiblePages.ts and the
  // server-side twin in backend/app/api/dependencies.py.
  const filteredMenuItems = mainMenuConfig.filter((item) => canAccessPage(user, item.id))

  const enabledMainCount = filteredMenuItems.filter((i) => i.enabled).length

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-12">
      {/* ══════════════════════════════════════════════════
          HERO IDENTITY CARD (Apple-style Header Banner)
          ══════════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-[18px] bg-white border border-black/[0.06] p-5 sm:p-7 shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          {/* Left: Avatar + Identity */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0 group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleAvatarFileSelect}
                className="hidden"
                aria-label="อัปโหลดรูปโปรไฟล์"
              />

              {user.avatar ? (
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-[22px] shadow-md ring-4 ring-black/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.avatar}
                    alt={user.name || 'โปรไฟล์'}
                    className="h-full w-full object-cover"
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-[22px] bg-gradient-to-tr from-[#0066cc] via-[#0077ed] to-[#38bdf8] text-2xl sm:text-3xl font-extrabold text-white shadow-md ring-4 ring-black/[0.03]">
                  {isUploadingAvatar ? (
                    <Loader2 size={24} className="animate-spin text-white" />
                  ) : (
                    user.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
              )}

              {/* Upload photo button badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="เปลี่ยนรูปโปรไฟล์ (ไม่เกิน 1MB)"
                aria-label="เปลี่ยนรูปโปรไฟล์"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-md ring-1 ring-black/[0.08] transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
              >
                <Camera size={13} className="text-[#0066cc]" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1d1d1f] truncate">
                  {user.name || 'ผู้ใช้งาน'}
                </h1>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 ring-1 ring-purple-600/20">
                    <ShieldAlert size={11} /> ผู้ดูแลระบบ (Admin)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-500/20">
                    <User size={11} /> ผู้ใช้ทั่วไป (User)
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#6e6e73]">
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} className="text-[#86868b]" />
                  {user.email || 'ไม่ได้ระบุอีเมล'}
                </span>
                {user.username && (
                  <span className="inline-flex items-center gap-1">
                    <AtSign size={12} className="text-[#86868b]" />
                    {user.username}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats & Status */}
          <div className="flex items-center gap-2 self-start sm:self-center border-t sm:border-t-0 border-black/[0.05] pt-3 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              พร้อมใช้งาน
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          RESPONSIVE NAVIGATION TABS (Segmented Control)
          ══════════════════════════════════════════════════ */}
      <nav aria-label="แท็บตั้งค่าโปรไฟล์" className="flex items-center gap-1.5 p-1.5 bg-[#eaebee]/80 backdrop-blur-md rounded-[18px] overflow-x-auto no-scrollbar border border-black/[0.04]">
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
            activeTab === 'profile'
              ? 'bg-white text-[#0066cc] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/50'
          }`}
        >
          <User size={15} />
          <span>ข้อมูลส่วนตัว &amp; ความปลอดภัย</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('preferences')}
          className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
            activeTab === 'preferences'
              ? 'bg-white text-[#0066cc] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/50'
          }`}
        >
          <Sliders size={15} />
          <span>ทางลัด &amp; ปรับแต่งเมนู</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeTab === 'preferences'
                ? 'bg-[#0066cc]/10 text-[#0066cc]'
                : 'bg-black/[0.05] text-[#6e6e73]'
            }`}
          >
            {quickLinks.length + enabledMainCount}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'admin'
                ? 'bg-white text-purple-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/50'
            }`}
          >
            <ShieldAlert size={15} className={activeTab === 'admin' ? 'text-purple-600' : 'text-[#86868b]'} />
            <span>จัดการผู้ใช้งาน</span>
            <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[10px] font-bold">
              Admin
            </span>
          </button>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════
          TAB 1: ข้อมูลส่วนตัว & ความปลอดภัย
          ══════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start min-h-[480px]"
          >
          {/* Card 1.1: ข้อมูลส่วนตัว */}
          <SectionCard
            icon={<User size={19} aria-hidden="true" />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            iconRing="ring-emerald-200/60"
            title="ข้อมูลส่วนตัว"
            subtitle="อัปเดตชื่อที่แสดงและอีเมลสำหรับใช้งานในระบบ"
          >
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <InsetField
                id="profile-name"
                label="ชื่อที่แสดง"
                value={name}
                onChange={setName}
                placeholder="เช่น สมชาย ใจดี"
                icon={<User size={16} aria-hidden="true" />}
                required
              />
              <InsetField
                id="profile-email"
                label="อีเมลสำหรับเข้าสู่ระบบ"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="name@company.com"
                icon={<Mail size={16} aria-hidden="true" />}
                required
                autoComplete="email"
              />
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0071e3] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                >
                  {isSavingProfile ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                  ) : (
                    <Check size={14} aria-hidden="true" />
                  )}
                  {isSavingProfile ? 'กำลังบันทึก…' : 'บันทึกข้อมูลส่วนตัว'}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Card 1.2: รหัสผ่าน & ความปลอดภัย */}
          <SectionCard
            icon={<Lock size={19} aria-hidden="true" />}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
            iconRing="ring-rose-200/60"
            title="รหัสผ่าน &amp; ความปลอดภัย"
            subtitle="เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชีคุณ"
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <InsetField
                id="current-password"
                label="รหัสผ่านปัจจุบัน"
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={setOldPassword}
                placeholder="กรอกรหัสผ่านปัจจุบัน"
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
                id="new-password"
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

              {/* Strength Meter */}
              {newPassword && (
                <div className="-mt-1 rounded-2xl bg-[#f8fafc] p-3.5 ring-1 ring-black/[0.04]">
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
                  <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#6e6e73]">
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
                id="confirm-new-password"
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

              {confirmPassword && (
                <div
                  className={`-mt-1 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[11.5px] font-semibold ring-1 ${
                    newPassword === confirmPassword
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-rose-50 text-rose-700 ring-rose-200'
                  }`}
                >
                  {newPassword === confirmPassword ? (
                    <><Check size={13} /> รหัสผ่านยืนยันตรงกัน</>
                  ) : (
                    <><Info size={13} /> รหัสผ่านยืนยันยังไม่ตรงกัน</>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0071e3] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                >
                  {isChangingPassword ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                  ) : (
                    <Save size={14} aria-hidden="true" />
                  )}
                  {isChangingPassword ? 'กำลังบันทึก…' : 'อัปเดตรหัสผ่านใหม่'}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Card 1.3: ข้อมูลส่วนตัว (PDPA) */}
          <SectionCard
            icon={<ShieldCheck size={19} aria-hidden="true" />}
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
            iconRing="ring-sky-200/60"
            title="ข้อมูลส่วนตัวของฉัน (PDPA)"
            subtitle="ใช้สิทธิ์ของเจ้าของข้อมูล — ส่งออกสำเนา หรือลบบัญชีของคุณ"
          >
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#f8fafc] p-4 ring-1 ring-black/[0.04]">
                <p className="text-[12.5px] font-semibold text-[#1d1d1f]">ส่งออกข้อมูลของฉัน</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
                  ดาวน์โหลดสำเนาข้อมูลบัญชี การตั้งค่า และรายการอุปกรณ์ที่เข้าสู่ระบบ เป็นไฟล์ JSON
                </p>
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[12.5px] font-bold text-[#1d1d1f] transition-all hover:border-[#0066cc]/40 hover:text-[#0066cc] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Download size={14} aria-hidden="true" />
                  )}
                  {isExporting ? 'กำลังเตรียมไฟล์…' : 'ส่งออกข้อมูลของฉัน'}
                </button>
              </div>

              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 p-4">
                <p className="text-[12.5px] font-semibold text-rose-700">ลบบัญชีของฉัน</p>
                <p className="mt-1 text-[12px] leading-relaxed text-rose-700/80">
                  บัญชีจะถูกย้ายไปถังขยะและใช้งานไม่ได้ทันที ผู้ดูแลระบบกู้คืนได้ภายใน 30 วัน
                  แล้วจึงลบถาวร กรุณากรอกรหัสผ่านเพื่อยืนยัน
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder="รหัสผ่านปัจจุบัน"
                    autoComplete="current-password"
                    className="min-h-[40px] flex-1 rounded-full border border-rose-200 bg-white px-4 py-2 text-[13px] text-[#1d1d1f] outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                  />
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-rose-700 disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    {isDeletingAccount ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 size={14} aria-hidden="true" />
                    )}
                    {isDeletingAccount ? 'กำลังลบ…' : 'ลบบัญชี'}
                  </button>
                </div>
              </div>

              <p className="text-[11.5px] text-[#6e6e73]">
                อ่าน{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0066cc] underline"
                >
                  นโยบายความเป็นส่วนตัว
                </a>{' '}
                และ{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0066cc] underline"
                >
                  ข้อตกลงการใช้งาน
                </a>
              </p>
            </div>
          </SectionCard>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 2: ทางลัด & ปรับแต่งเมนู
          ══════════════════════════════════════════════════ */}
      {activeTab === 'preferences' && (
        <motion.div
          key="preferences"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start min-h-[480px]"
        >
          {/* Card 2.1: การตั้งค่าเมนูหลัก */}
          <SectionCard
            icon={<LayoutGrid size={19} aria-hidden="true" />}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            iconRing="ring-violet-200/60"
            title="เมนูหลักของระบบ"
            subtitle="เปิด/ปิด และจัดลำดับรายการในแถบเมนูด้านข้าง"
            badge={`${enabledMainCount} เมนูเปิดใช้งาน`}
          >
            <div className="space-y-2">
              {filteredMenuItems.map((item, idx, arr) => {
                const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-all duration-150 ${
                      item.enabled
                        ? 'bg-white ring-black/[0.06] shadow-2xs'
                        : 'bg-[#f5f5f7] ring-transparent opacity-60'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                        item.enabled ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-bold tracking-tight text-[#1d1d1f]">
                          {item.name}
                        </span>
                        {item.required && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-[1px] text-[9.5px] font-bold text-slate-500 ring-1 ring-slate-200">
                            บังคับ
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 truncate text-[11px] text-[#6e6e73]">{item.description}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveMainMenuItem(item.id, 'up')}
                        disabled={idx === 0}
                        aria-label="ย้ายขึ้น"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMainMenuItem(item.id, 'down')}
                        disabled={idx === arr.length - 1}
                        aria-label="ย้ายลง"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>

                      {/* iOS Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.enabled}
                        aria-label={`${item.enabled ? 'ซ่อน' : 'แสดง'} ${item.name}`}
                        disabled={!!item.required}
                        onClick={() => toggleMainMenuItem(item.id)}
                        style={{
                          width: '44px',
                          height: '28px',
                          minWidth: '44px',
                          minHeight: '28px',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                        }}
                        className={`relative ml-1 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc] disabled:cursor-not-allowed ${
                          item.enabled ? 'bg-[#0066cc]' : 'bg-[#e5e5ea]'
                        } ${item.required ? 'opacity-70' : ''}`}
                      >
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            transform: item.enabled ? 'translateX(16px)' : 'translateX(0px)',
                          }}
                          className="pointer-events-none inline-block rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15),0_0_1px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-in-out"
                        />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-4 text-[11.5px] text-[#86868b] flex items-center gap-1.5">
              <Info size={13} className="shrink-0 text-[#86868b]" aria-hidden="true" />
              รายการที่ปิดจะไม่แสดงในแถบเมนูข้าง รายการ &quot;บังคับ&quot; จำเป็นต่อระบบไม่สามารถปิดได้
            </p>
          </SectionCard>

          {/* Card 2.2: ควิกลิ้งค์ */}
          <SectionCard
            icon={<Link2 size={19} aria-hidden="true" />}
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
            iconRing="ring-sky-200/60"
            title="ควิกลิ้งค์ (Quick Links)"
            subtitle="ทางลัดเข้าสู่ระบบงานหรือเว็บไซต์ แสดงในแถบเมนูข้าง"
            badge={`${quickLinks.length} รายการ`}
            action={
              <button
                type="button"
                onClick={openCreateQuickLink}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0066cc] px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-sm transition-all hover:bg-[#0071e3] active:scale-95"
              >
                <Plus size={13} aria-hidden="true" />
                เพิ่มลิงก์
              </button>
            }
          >
            {quickLinks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-black/[0.06]">
                  <Link2 size={20} aria-hidden="true" />
                </div>
                <h3 className="text-[14px] font-bold text-[#1d1d1f]">ยังไม่มีควิกลิ้งค์</h3>
                <p className="mx-auto mt-1 max-w-xs text-[12px] text-[#6e6e73] leading-relaxed">
                  เพิ่มทางลัดสำหรับเปิดเว็บไซต์ที่ใช้บ่อย เพื่อความสะดวกรวดเร็ว
                </p>
                <button
                  type="button"
                  onClick={openCreateQuickLink}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0066cc] px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#0071e3]"
                >
                  <Plus size={13} aria-hidden="true" />
                  สร้างควิกลิ้งค์แรก
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {quickLinks.map((link, index) => {
                  const Icon = QUICK_LINK_ICON_MAP[link.icon] || Link2
                  const linkMeta = describeQuickLink(link.url)
                  const external = isExternalUrl(link.url)
                  return (
                    <div
                      key={link.id}
                      className="group flex items-center gap-3 rounded-2xl bg-white p-2.5 sm:p-3 ring-1 ring-black/[0.05] transition-all hover:bg-[#f8fafc] shadow-2xs"
                    >
                      <div className="shrink-0">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-[14px] shadow-2xs ring-1 ring-black/[0.06]"
                          style={{ backgroundColor: `${link.color || '#0066cc'}15` }}
                        >
                          <Icon size={17} aria-hidden="true" style={{ color: link.color || '#0066cc' }} />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate text-[13.5px] font-bold tracking-tight text-[#1d1d1f]">
                            {link.label}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-[1px] text-[9.5px] font-bold ring-1 ${
                              external
                                ? 'bg-sky-50 text-sky-700 ring-sky-200'
                                : 'bg-violet-50 text-violet-700 ring-violet-200'
                            }`}
                          >
                            {linkMeta.tone}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#6e6e73]">
                          {link.url}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveQuickLink(link.id, 'up')}
                          disabled={index === 0}
                          aria-label="ย้ายขึ้น"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronUp size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveQuickLink(link.id, 'down')}
                          disabled={index === quickLinks.length - 1}
                          aria-label="ย้ายลง"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronDown size={14} aria-hidden="true" />
                        </button>
                        <a
                          href={link.url}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noopener noreferrer' : undefined}
                          className="flex h-7 items-center justify-center sm:gap-1 rounded-lg px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                          aria-label={`เปิดลิงก์ ${link.label}`}
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                          <span className="hidden sm:inline">เปิด</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => openEditQuickLink(link)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                          aria-label="แก้ไขลิงก์"
                        >
                          <PencilLine size={12} aria-hidden="true" />
                          <span className="hidden sm:inline">แก้ไข</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuickLink(link.id)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
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
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 3: การจัดการผู้ใช้งาน (Admin Panel)
          ══════════════════════════════════════════════════ */}
      {activeTab === 'admin' && isAdmin && (
        <motion.div
          key="admin"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="space-y-4 min-h-[600px]"
        >
          {/* User Management Component */}
          <UserManagement />
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════
          QUICK LINK DIALOG (CREATE / EDIT)
          ══════════════════════════════════════════════════ */}
      <Dialog open={quickLinkDialogOpen} onOpenChange={setQuickLinkDialogOpen}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuickLinkId ? 'แก้ไขควิกลิ้งค์' : 'สร้างควิกลิ้งค์ใหม่'}</DialogTitle>
            <DialogDescription>
              {editingQuickLinkId
                ? 'ปรับแต่งชื่อ ลิงก์ ไอคอน และสีของลิงก์นี้'
                : 'เพิ่มทางลัดสำหรับเว็บไซต์หรือหน้าที่คุณใช้งานบ่อย'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitQuickLink}>
            <DialogBody className="space-y-4">
              {/* Preview card */}
              <div className="rounded-[18px] bg-[#f5f5f7] p-3.5 ring-1 ring-black/[0.04]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] mb-2">
                  ตัวอย่างการแสดงผล
                </div>
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                      previewMeta.tone === 'ภายนอก'
                        ? 'bg-sky-50 text-sky-700 ring-sky-200'
                        : previewMeta.tone === 'ภายใน'
                          ? 'bg-violet-50 text-violet-700 ring-violet-200'
                          : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}
                  >
                    {previewMeta.tone}
                  </span>
                </div>
              </div>

              {/* Label + URL */}
              <div className="space-y-3">
                <InsetField
                  id="ql-label"
                  label="ชื่อลิงก์"
                  value={qlLabel}
                  onChange={setQlLabel}
                  placeholder="เช่น Gmail, งาน IT, Dashboard"
                  icon={<Bookmark size={16} aria-hidden="true" />}
                  required
                />
                <InsetField
                  id="ql-url"
                  label="URL / ที่อยู่ลิงก์"
                  value={qlUrl}
                  onChange={setQlUrl}
                  placeholder="https://mail.google.com หรือ /dashboard"
                  icon={<Link2 size={16} aria-hidden="true" />}
                  required
                />
              </div>

              {/* Icon Picker (with scroll container to avoid huge modal on laptops/phones) */}
              <div>
                <label className="mb-1.5 ml-1 block text-[11px] font-bold tracking-wide uppercase text-[#6e6e73]">
                  ไอคอน · <span className="text-[#0066cc] font-normal normal-case tracking-normal">{previewIconLabel}</span>
                </label>
                <div className="rounded-2xl bg-[#f8fafc] p-2 ring-1 ring-black/[0.04] max-h-44 overflow-y-auto">
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
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
                              ? 'bg-white shadow-sm ring-2 ring-[#0066cc]'
                              : 'bg-white/50 hover:bg-white ring-1 ring-black/[0.04] hover:ring-black/[0.08]',
                          ].join(' ')}
                        >
                          <OptIcon
                            size={15}
                            aria-hidden="true"
                            className={active ? 'text-[#0066cc]' : 'text-slate-500'}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <div className="mb-1.5 ml-1 flex items-center justify-between">
                  <label className="text-[11px] font-bold tracking-wide uppercase text-[#6e6e73]">
                    สีของไอคอน
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-4 w-4 rounded-md ring-1 ring-black/10"
                      style={{ backgroundColor: qlColor }}
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-mono text-[#6e6e73] uppercase">{qlColor}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-2.5 ring-1 ring-black/[0.04]">
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
                            'h-7 w-7 rounded-lg transition-all duration-150 ring-offset-2',
                            active ? 'ring-2 ring-[#1d1d1f] scale-110 shadow-sm' : 'ring-1 ring-black/10 hover:scale-105',
                          ].join(' ')}
                          style={{ backgroundColor: color }}
                        />
                      )
                    })}
                    <label className="group relative flex h-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white text-slate-400 ring-1 ring-black/10 transition-all hover:text-slate-600 hover:scale-105 px-2">
                      <Palette size={13} aria-hidden="true" />
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

              {/* Validation Hint */}
              <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] text-[#6e6e73] ring-1 ring-slate-200/60 leading-relaxed">
                <Info size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <div>
                  <strong className="font-bold text-[#475569]">รูปแบบลิงก์ที่รองรับ:</strong>
                  <ul className="mt-0.5 ml-3 space-y-0.5 list-disc text-[10.5px]">
                    <li>ภายนอก: <code className="px-1 py-0.2 rounded bg-white text-[#0066cc]">https://...</code></li>
                    <li>ภายใน: <code className="px-1 py-0.2 rounded bg-white text-[#0066cc]">/dashboard</code></li>
                  </ul>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setQuickLinkDialogOpen(false)}
                className="w-full sm:w-auto rounded-full bg-[#f5f5f7] px-5 py-2.5 text-[13px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-[0.95]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0071e3] active:scale-[0.95]"
              >
                <Check size={14} aria-hidden="true" />
                {editingQuickLinkId ? 'บันทึกการแก้ไข' : 'สร้างลิงก์'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
