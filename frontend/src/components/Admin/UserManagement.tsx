'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { useToast } from '@/components/Toast/ToastProvider'
import { useAuth } from '@/components/Auth/AuthProvider'
import { showDeleteConfirm } from '@/utils/sweetalert'
import {
  Settings, Edit, Check, X, ShieldAlert, User, CheckCircle2, Circle, Trash2, Loader2,
  Search, UserPlus, RotateCcw, ChevronLeft, ChevronRight, Eraser, ChevronDown
} from 'lucide-react'

// Define a simplified User type for admin management
interface AdminUser {
  id: number
  email: string | null
  username: string | null
  name: string
  role: string
  is_active: boolean
  accessible_pages: string | null
  deleted_at?: string | null
}

/** A soft-deleted account, as returned by `GET /api/v1/users/deleted`. */
interface TrashUser extends AdminUser {
  deleted_at: string
  days_remaining: number
  purge_at: string
}

const AVAILABLE_PAGES = [
  { id: 'dashboard', label: 'หน้าหลัก (Dashboard)' },
  { id: 'profile', label: 'หน้าโปรไฟล์ (Profile)' },
  { id: 'camera', label: 'กล้อง (Camera)' },
]

const PAGE_SIZE = 10

/** Thai label for a trash row's remaining restore window. */
const remainingLabel = (days: number) =>
  days <= 0 ? 'หมดเวลาแล้ว' : `กู้คืนได้อีก ${days} วัน`

/**
 * Readable message out of an API error body. FastAPI answers validation
 * failures with `detail` as a list of field errors, while our own handlers send
 * a plain string — the create form surfaces both.
 */
/**
 * Format an API timestamp for the trash table. The backend stores naive UTC, so
 * a value without a zone suffix is read as UTC — without that, a deletion made
 * this morning shows up as yesterday evening in a UTC+7 browser.
 */
const formatDateTime = (value: string): string => {
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Short Thai title for an HTTP failure, shared by the action handlers. */
const statusTitle = (status: number): string => {
  if (status === 400) return 'ทำรายการไม่ได้'
  if (status === 401 || status === 403) return 'ไม่ได้รับอนุญาต'
  if (status === 404) return 'ไม่พบข้อมูล'
  if (status === 409) return 'ข้อมูลซ้ำ'
  if (status === 422) return 'ข้อมูลไม่ถูกต้อง'
  if (status === 429) return 'ทำรายการบ่อยเกินไป'
  return 'เกิดข้อผิดพลาด'
}

const apiMessage = (data: unknown, fallback: string): string => {
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

/** Human-readable identifier for confirm dialogs, toasts and aria-labels. */
const displayLabel = (u: AdminUser) => u.email || u.username || u.name

interface FilterOption {
  value: string
  label: string
  icon?: React.ReactNode
}

const ROLE_OPTIONS: FilterOption[] = [
  { value: '', label: 'ทุกสิทธิ์', icon: <User size={13} className="text-[#86868b]" /> },
  { value: 'admin', label: 'Admin', icon: <ShieldAlert size={13} className="text-purple-600" /> },
  { value: 'user', label: 'User', icon: <User size={13} className="text-slate-600" /> },
]

const STATUS_OPTIONS: FilterOption[] = [
  { value: '', label: 'ทุกสถานะ', icon: <Circle size={13} className="text-[#86868b]" /> },
  { value: 'active', label: 'ใช้งานปกติ', icon: <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" /> },
  { value: 'suspended', label: 'ระงับบัญชี', icon: <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" /> },
  { value: 'trash', label: 'ถังขยะ (ลบแล้ว)', icon: <Trash2 size={13} className="text-amber-600 shrink-0" /> },
]

function FilterDropdown({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string
  value: string
  onChange: (val: string) => void
  options: FilterOption[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value) || options[0]

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto">
      {/* Visual Custom Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ minHeight: '42px', height: '42px', borderRadius: '9999px' }}
        className={`w-full sm:w-auto inline-flex items-center justify-between gap-2.5 rounded-full border px-4 text-[13px] font-bold transition-all active:scale-[0.98] ${
          isOpen
            ? 'border-[#0066cc] bg-white ring-2 ring-[#0066cc]/20 text-[#1d1d1f]'
            : value
              ? 'border-[#0066cc]/40 bg-[#0066cc]/5 text-[#0066cc] hover:bg-[#0066cc]/10'
              : 'border-black/[0.08] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
        }`}
      >
        <span className="inline-flex items-center gap-2 truncate">
          {selectedOption.icon}
          <span>{selectedOption.label}</span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#0066cc]' : 'text-[#86868b]'
          }`}
        />
      </button>

      {/* Floating Apple-Style Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[175px] max-w-[240px] overflow-hidden rounded-[18px] border border-black/[0.08] bg-white/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#0066cc]/10 text-[#0066cc]'
                      : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    {opt.icon}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} className="shrink-0 text-[#0066cc]" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Accessible native select for test automation & screen readers */}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function UserManagement() {
  const { success: showSuccess, error: showError } = useToast()
  // The signed-in admin: deleting your own account is refused by the backend
  // ("คุณไม่สามารถลบบัญชีผู้ใช้ของตัวเองได้"), so the row's button says so
  // up front instead of letting the user discover it after a confirm dialog.
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  // ── Search / filter / paging ────────────────────────────────────────
  // The search box is debounced so a fast typist does not fire a request per
  // keystroke, and the filters are sent to the API rather than applied to the
  // page in hand — otherwise "no results" would only ever mean "not on this
  // page".
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  // NaN while the API did not report a total: the pager then falls back to
  // "a full page means there may be more".
  const [total, setTotal] = useState(Number.NaN)
  const [trash, setTrash] = useState<TrashUser[]>([])

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const [editRole, setEditRole] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editPages, setEditPages] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [trashBusyId, setTrashBusyId] = useState<number | null>(null)
  // Learn the real window from the API instead of hard-coding it in the copy.
  const [retentionDays, setRetentionDays] = useState(30)
  const deleteInFlight = useRef(false)
  const trashActionInFlight = useRef(false)

  // ── Create user ─────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    role: 'user',
    pages: AVAILABLE_PAGES.map((p) => p.id),
  })
  const [isCreatingSaving, setIsCreatingSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // A new search term or filter is a new result set: start it on page 1.
  useEffect(() => {
    setPage(0)
  }, [debouncedQuery, roleFilter, statusFilter])

  const loadUsers = useCallback(async () => {
    setIsFetching(true)
    try {
      if (statusFilter === 'trash') {
        const res = await fetchWithAuth('/api/v1/users/deleted')
        if (res.ok) {
          setTrash(await res.json())
        } else {
          showError('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อที่ถูกลบได้')
        }
        return
      }

      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      })
      const term = debouncedQuery.trim()
      if (term) params.set('q', term)
      if (roleFilter) params.set('role', roleFilter)
      if (statusFilter === 'active') params.set('is_active', 'true')
      if (statusFilter === 'suspended') params.set('is_active', 'false')

      const res = await fetchWithAuth(`/api/v1/users/?${params.toString()}`)
      if (!res.ok) {
        showError('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้')
        return
      }

      setUsers(await res.json())
      const reported = res.headers.get('X-Total-Count')
      setTotal(reported === null || reported === '' ? Number.NaN : Number(reported))
    } catch (e) {
      console.error(e)
    } finally {
      setIsFetching(false)
      setInitialLoading(false)
    }
  }, [debouncedQuery, roleFilter, statusFilter, page, showError])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const hasNextPage = useMemo(
    () => (Number.isNaN(total) ? users.length === PAGE_SIZE : (page + 1) * PAGE_SIZE < total),
    [total, users.length, page],
  )

  const filteredTrash = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase()
    if (!term) return trash
    return trash.filter(t =>
      (t.name && t.name.toLowerCase().includes(term)) ||
      (t.email && t.email.toLowerCase().includes(term)) ||
      (t.username && t.username.toLowerCase().includes(term))
    )
  }, [trash, debouncedQuery])

  const isFiltered = Boolean(debouncedQuery.trim() || roleFilter || statusFilter)

  const clearFilters = () => {
    setQuery('')
    setDebouncedQuery('')
    setRoleFilter('')
    setStatusFilter('')
  }

  const openEdit = (user: AdminUser) => {
    setEditingUser(user)
    setEditRole(user.role)
    setEditIsActive(user.is_active)
    try {
      setEditPages(user.accessible_pages ? JSON.parse(user.accessible_pages) : AVAILABLE_PAGES.map(p => p.id))
    } catch {
      setEditPages(AVAILABLE_PAGES.map(p => p.id))
    }
  }

  const closeEdit = () => {
    setEditingUser(null)
  }

  const togglePage = (pageId: string) => {
    setEditPages(prev => 
      prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
    )
  }

  const handleSave = async () => {
    if (!editingUser) return
    setIsSaving(true)
    try {
      const payload = {
        role: editRole,
        is_active: editIsActive,
        accessible_pages: JSON.stringify(editPages)
      }
      const res = await fetchWithAuth(`/api/v1/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        showSuccess('สำเร็จ', 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว')
        loadUsers()
        closeEdit()
      } else {
        const data = await res.json().catch(() => ({}))
        showError('เกิดข้อผิดพลาด', data.detail || 'ไม่สามารถอัปเดตได้')
      }
    } catch (e) {
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (user: AdminUser) => {
    // One deletion at a time. A ref (not state) is the latch: it must already be
    // set while the confirmation dialog is still open, before any re-render.
    if (deleteInFlight.current) return
    deleteInFlight.current = true

    const label = displayLabel(user)
    try {
      const confirmed = await showDeleteConfirm(
        'ลบผู้ใช้งานนี้?',
        `บัญชี "${label}" จะถูกย้ายเข้าถังขยะ: ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ทันที ` +
        `และกู้คืนได้ภายใน ${retentionDays} วันก่อนระบบลบถาวร`
      )
      if (!confirmed.isConfirmed) return

      setDeletingId(user.id)
      const res = await fetchWithAuth(`/api/v1/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        // Drop the row straight away — no need to re-fetch the whole list.
        setUsers(prev => prev.filter(u => u.id !== user.id))
        setTotal(prev => (Number.isNaN(prev) ? prev : Math.max(0, prev - 1)))
        const days = data?.data?.retention_days
        if (typeof days === 'number') setRetentionDays(days)
        showSuccess(
          'ย้ายเข้าถังขยะแล้ว',
          `ลบบัญชี ${label} — กู้คืนได้ในแท็บ "ถังขยะ" ภายใน ${typeof days === 'number' ? days : retentionDays} วัน`
        )
        return
      }

      if (res.status === 400) {
        showError('ลบไม่ได้', data.detail || 'คำขอนี้ถูกปฏิเสธ')
      } else if (res.status === 404) {
        showError('ไม่พบผู้ใช้', 'บัญชีนี้อาจถูกลบไปแล้ว — กำลังโหลดรายชื่อใหม่')
        loadUsers()
      } else if (res.status === 429) {
        showError('ทำรายการบ่อยเกินไป', 'กรุณารอสักครู่แล้วลองใหม่อีกครั้ง')
      } else if (res.status === 401 || res.status === 403) {
        showError('ไม่ได้รับอนุญาต', 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบผู้ใช้ได้')
      } else {
        showError('เกิดข้อผิดพลาด', data.detail || 'ไม่สามารถลบผู้ใช้ได้')
      }
    } catch (e) {
      console.error(e)
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      deleteInFlight.current = false
      setDeletingId(null)
    }
  }

  const openCreate = () => {
    setCreateForm({
      username: '',
      display_name: '',
      email: '',
      password: '',
      role: 'user',
      pages: AVAILABLE_PAGES.map((p) => p.id),
    })
    setIsCreating(true)
  }

  const toggleCreatePage = (pageId: string) => {
    setCreateForm(prev => ({
      ...prev,
      pages: prev.pages.includes(pageId)
        ? prev.pages.filter(p => p !== pageId)
        : [...prev.pages, pageId],
    }))
  }

  const handleCreate = async () => {
    const username = createForm.username.trim()
    const displayName = createForm.display_name.trim()

    // Validate here so the admin gets a sentence instead of a bare 422, and so
    // the round trip is only spent on a request that can succeed.
    if (username.length < 3) {
      showError('ข้อมูลไม่ครบถ้วน', 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร')
      return
    }
    if (!displayName) {
      showError('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อที่แสดง')
      return
    }
    if (createForm.password.length < 8) {
      showError('ข้อมูลไม่ครบถ้วน', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (createForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      showError('อีเมลไม่ถูกต้อง', 'กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง')
      return
    }

    setIsCreatingSaving(true)
    try {
      const res = await fetchWithAuth('/api/v1/users/admin-create', {
        method: 'POST',
        body: JSON.stringify({
          username,
          display_name: displayName,
          password: createForm.password,
          email: createForm.email.trim() || null,
          role: createForm.role,
          accessible_pages: JSON.stringify(createForm.pages),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        showSuccess('สร้างผู้ใช้สำเร็จ', `เพิ่มบัญชี ${username} เรียบร้อยแล้ว`)
        setIsCreating(false)
        clearFilters()
        await loadUsers()
        return
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถสร้างผู้ใช้ได้'))
    } catch (e) {
      console.error(e)
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsCreatingSaving(false)
    }
  }

  const handleRestore = async (user: TrashUser) => {
    if (trashActionInFlight.current) return
    trashActionInFlight.current = true

    const label = displayLabel(user)
    setTrashBusyId(user.id)
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}/restore`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setTrash(prev => prev.filter(u => u.id !== user.id))
        showSuccess('กู้คืนผู้ใช้สำเร็จ', `${label} กลับมาใช้งานได้ตามปกติแล้ว`)
        return
      }

      if (res.status === 404) {
        showError('ไม่พบบัญชีในถังขยะ', 'บัญชีนี้อาจถูกลบถาวรไปแล้ว — กำลังโหลดรายการใหม่')
        await loadUsers()
        return
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถกู้คืนผู้ใช้ได้'))
    } catch (e) {
      console.error(e)
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      trashActionInFlight.current = false
      setTrashBusyId(null)
    }
  }

  /** The one irreversible action: only reachable from the trash, by design. */
  const handlePurge = async (user: TrashUser) => {
    if (trashActionInFlight.current) return

    const label = displayLabel(user)
    const confirmed = await showDeleteConfirm(
      'ลบบัญชีนี้ถาวร?',
      `บัญชี "${label}" และประวัติเซสชันจะถูกลบออกจากฐานข้อมูลทันที ` +
      'และกู้คืนไม่ได้อีก (ประวัติการใช้งานใน Audit Log จะยังอยู่)'
    )
    if (!confirmed.isConfirmed) return

    trashActionInFlight.current = true
    setTrashBusyId(user.id)
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}?purge=true`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setTrash(prev => prev.filter(u => u.id !== user.id))
        showSuccess('ลบถาวรสำเร็จ', `ลบบัญชี ${label} ออกจากระบบแล้ว`)
        return
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถลบถาวรได้'))
    } catch (e) {
      console.error(e)
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      trashActionInFlight.current = false
      setTrashBusyId(null)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0066cc]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {editingUser ? (
        <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.06]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/[0.04] bg-[#fbfbfc] px-6 py-5">
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                <Edit size={18} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold tracking-tight text-[#1d1d1f]">
                  แก้ไขผู้ใช้งาน: {editingUser.name}
                </h3>
                <p className="text-[13px] text-[#6e6e73]">{editingUser.email || editingUser.username}</p>
              </div>
            </div>
            <button 
              onClick={closeEdit} 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[#6e6e73] transition-colors hover:bg-black/10 self-end sm:self-auto"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Status */}
            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                สถานะการใช้งาน
              </label>
              <div 
                onClick={() => setEditIsActive(!editIsActive)}
                className="group flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f8fafc] p-4 ring-1 ring-black/[0.04] transition-all hover:bg-white hover:shadow-sm"
              >
                {editIsActive ? (
                  <CheckCircle2 size={22} className="text-[#0066cc]" />
                ) : (
                  <Circle size={22} className="text-slate-300 group-hover:text-slate-400" />
                )}
                <div>
                  <span className="block text-[14px] font-semibold text-[#1d1d1f]">เปิดใช้งานบัญชี (Active)</span>
                  <span className="block text-[12px] text-[#6e6e73]">ผู้ใช้สามารถเข้าสู่ระบบและใช้งานได้ตามปกติ</span>
                </div>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                สิทธิ์การใช้งาน (Role)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* User Role Card */}
                <div 
                  onClick={() => setEditRole('user')}
                  className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-all duration-200 ${
                    editRole === 'user' 
                      ? 'bg-white ring-2 ring-[#0066cc] shadow-[0_4px_12px_rgba(0,102,204,0.12)]' 
                      : 'bg-[#f8fafc] ring-1 ring-black/[0.04] hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    editRole === 'user' ? 'bg-[#0066cc] text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                  }`}>
                    <User size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className={`block text-[14px] font-semibold transition-colors ${
                      editRole === 'user' ? 'text-[#0066cc]' : 'text-[#1d1d1f]'
                    }`}>ผู้ใช้งานทั่วไป (User)</span>
                    <span className="block mt-0.5 text-[12px] text-[#6e6e73] leading-relaxed">เข้าถึงเฉพาะฟีเจอร์ที่ได้รับอนุญาต</span>
                  </div>
                  {editRole === 'user' && (
                    <div className="absolute right-4 top-4 text-[#0066cc] animate-in zoom-in duration-200">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>

                {/* Admin Role Card */}
                <div 
                  onClick={() => setEditRole('admin')}
                  className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-all duration-200 ${
                    editRole === 'admin' 
                      ? 'bg-white ring-2 ring-purple-600 shadow-[0_4px_12px_rgba(147,51,234,0.12)]' 
                      : 'bg-[#f8fafc] ring-1 ring-black/[0.04] hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    editRole === 'admin' ? 'bg-purple-600 text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                  }`}>
                    <ShieldAlert size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className={`block text-[14px] font-semibold transition-colors ${
                      editRole === 'admin' ? 'text-purple-700' : 'text-[#1d1d1f]'
                    }`}>ผู้ดูแลระบบ (Admin)</span>
                    <span className="block mt-0.5 text-[12px] text-[#6e6e73] leading-relaxed">มีสิทธิ์สูงสุดในการจัดการระบบทั้งหมด</span>
                  </div>
                  {editRole === 'admin' && (
                    <div className="absolute right-4 top-4 text-purple-600 animate-in zoom-in duration-200">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Accessible Pages */}
            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                หน้าที่สามารถเข้าถึงได้ (Accessible Pages)
              </label>
              <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.04] bg-[#f8fafc] divide-y divide-black/[0.04]">
                {AVAILABLE_PAGES.map(page => {
                  const isActive = editPages.includes(page.id);
                  return (
                    <div 
                      key={page.id}
                      onClick={() => togglePage(page.id)}
                      className="group flex cursor-pointer items-center gap-3 p-4 transition-all hover:bg-white"
                    >
                      {isActive ? (
                        <CheckCircle2 size={20} className="text-[#0066cc]" />
                      ) : (
                        <Circle size={20} className="text-slate-300 group-hover:text-slate-400" />
                      )}
                      <span className={`text-[14px] ${isActive ? 'font-semibold text-[#1d1d1f]' : 'font-medium text-[#6e6e73]'}`}>
                        {page.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-black/[0.04] bg-[#fbfbfc] px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button 
              onClick={closeEdit}
              className="w-full sm:w-auto rounded-full bg-[#f5f5f7] px-5 py-2.5 text-[13px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-[0.95]"
            >
              ยกเลิก
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0071e3]  active:scale-[0.95] disabled:opacity-50"
            >
              {isSaving ? 'กำลังบันทึก...' : <><Check size={14} /> บันทึกการแก้ไข</>}
            </button>
          </div>
        </div>
      ) : isCreating ? (
        <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.06]">
          <div className="flex items-center justify-between border-b border-black/[0.04] bg-[#fbfbfc] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold tracking-tight text-[#1d1d1f]">สร้างผู้ใช้งานใหม่</h3>
                <p className="text-[13px] text-[#6e6e73]">บัญชีใช้งานได้ทันทีหลังสร้าง — แจ้งรหัสผ่านให้ผู้ใช้อย่างปลอดภัย</p>
              </div>
            </div>
            <button
              onClick={() => setIsCreating(false)}
              aria-label="ปิดฟอร์มสร้างผู้ใช้"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[#6e6e73] transition-colors hover:bg-black/10"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="create-username" className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                  ชื่อผู้ใช้ (Username) *
                </label>
                <input
                  id="create-username"
                  value={createForm.username}
                  onChange={e => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="อย่างน้อย 3 ตัวอักษร"
                  autoComplete="off"
                  className="w-full rounded-2xl border-0 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] outline-none ring-1 ring-black/[0.04] transition-all placeholder:text-[#86868b] focus:bg-white focus:ring-2 focus:ring-[#0066cc]"
                />
              </div>
              <div>
                <label htmlFor="create-display-name" className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                  ชื่อที่แสดง (Display name) *
                </label>
                <input
                  id="create-display-name"
                  value={createForm.display_name}
                  onChange={e => setCreateForm(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full rounded-2xl border-0 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] outline-none ring-1 ring-black/[0.04] transition-all placeholder:text-[#86868b] focus:bg-white focus:ring-2 focus:ring-[#0066cc]"
                />
              </div>
              <div>
                <label htmlFor="create-email" className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                  อีเมล (ไม่บังคับ)
                </label>
                <input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  autoComplete="off"
                  className="w-full rounded-2xl border-0 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] outline-none ring-1 ring-black/[0.04] transition-all placeholder:text-[#86868b] focus:bg-white focus:ring-2 focus:ring-[#0066cc]"
                />
              </div>
              <div>
                <label htmlFor="create-password" className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                  รหัสผ่าน *
                </label>
                <input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={e => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border-0 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] outline-none ring-1 ring-black/[0.04] transition-all placeholder:text-[#86868b] focus:bg-white focus:ring-2 focus:ring-[#0066cc]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                สิทธิ์การใช้งาน (Role)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['user', 'admin'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setCreateForm(prev => ({ ...prev, role }))}
                    aria-pressed={createForm.role === role}
                    className={`group relative flex items-center gap-3 rounded-2xl p-4 text-left transition-all duration-200 ${
                      createForm.role === role
                        ? 'bg-white ring-2 ring-[#0066cc] shadow-[0_4px_12px_rgba(0,102,204,0.12)]'
                        : 'bg-[#f8fafc] ring-1 ring-black/[0.04] hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                      createForm.role === role ? 'bg-[#0066cc] text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {role === 'admin' ? <ShieldAlert size={18} strokeWidth={2.5} /> : <User size={18} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <span className="block text-[14px] font-semibold text-[#1d1d1f]">
                        {role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)'}
                      </span>
                      <span className="block mt-0.5 text-[12px] text-[#6e6e73] leading-relaxed">
                        {role === 'admin' ? 'มีสิทธิ์สูงสุดในการจัดการระบบทั้งหมด' : 'เข้าถึงเฉพาะฟีเจอร์ที่ได้รับอนุญาต'}
                      </span>
                    </div>
                    {createForm.role === role && (
                      <div className="absolute right-4 top-4 text-[#0066cc]"><CheckCircle2 size={20} /></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                หน้าที่สามารถเข้าถึงได้ (Accessible Pages)
              </label>
              <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.04] bg-[#f8fafc] divide-y divide-black/[0.04]">
                {AVAILABLE_PAGES.map(page => {
                  const isActive = createForm.pages.includes(page.id)
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => toggleCreatePage(page.id)}
                      aria-pressed={isActive}
                      className="group flex w-full items-center gap-3 p-4 text-left transition-all hover:bg-white"
                    >
                      {isActive ? (
                        <CheckCircle2 size={20} className="text-[#0066cc]" />
                      ) : (
                        <Circle size={20} className="text-slate-300 group-hover:text-slate-400" />
                      )}
                      <span className={`text-[14px] ${isActive ? 'font-semibold text-[#1d1d1f]' : 'font-medium text-[#6e6e73]'}`}>
                        {page.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-black/[0.04] bg-[#fbfbfc] px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              onClick={() => setIsCreating(false)}
              className="w-full sm:w-auto rounded-full bg-[#f5f5f7] px-5 py-2.5 text-[13px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-[0.95]"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreatingSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0071e3] active:scale-[0.95] disabled:opacity-50"
            >
              {isCreatingSaving ? 'กำลังสร้าง...' : <><UserPlus size={14} /> สร้างผู้ใช้</>}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative z-20 flex flex-col gap-3 rounded-[18px] border border-black/[0.06] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                {isFetching ? (
                  <Loader2 size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#0066cc]" />
                ) : (
                  <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
                )}
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="ค้นหาชื่อ อีเมล หรือชื่อผู้ใช้"
                  aria-label="ค้นหาผู้ใช้"
                  style={{ paddingLeft: '2.75rem', borderRadius: '9999px', minHeight: '42px', height: '42px' }}
                  className="w-full rounded-full border border-black/[0.08] bg-[#f5f5f7] pr-4 text-[13.5px] font-medium text-[#1d1d1f] outline-none transition-all placeholder:text-[#86868b] focus:bg-white focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                <FilterDropdown
                  ariaLabel="กรองตามสิทธิ์"
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={ROLE_OPTIONS}
                />
                <FilterDropdown
                  ariaLabel="กรองตามสถานะ"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_OPTIONS}
                />
              </div>
              {isFiltered && (
                <button
                  onClick={clearFilters}
                  style={{ minHeight: '42px', height: '42px' }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#f5f5f7] px-4 text-[13px] font-bold text-[#6e6e73] transition-all hover:bg-[#e8e8ed] hover:text-[#1d1d1f] active:scale-95"
                >
                  <Eraser size={13} /> ล้างตัวกรอง
                </button>
              )}
            </div>
            <button
              onClick={openCreate}
              style={{ minHeight: '42px', height: '42px' }}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#0071e3] active:scale-95"
            >
              <UserPlus size={14} /> เพิ่มผู้ใช้
            </button>
          </div>

          <div className="overflow-hidden rounded-[18px] border border-black/[0.06] bg-white min-h-[420px]">
            <div className={`h-0.5 w-full bg-[#0066cc] transition-all duration-300 ${isFetching ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
            <div className="overflow-x-auto min-h-[340px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#fbfbfc] text-[#6e6e73] text-[12px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4 border-b border-black/[0.04]">ชื่อผู้ใช้</th>
                    <th className="px-5 py-4 border-b border-black/[0.04]">สิทธิ์</th>
                    {statusFilter === 'trash' ? (
                      <>
                        <th className="px-5 py-4 border-b border-black/[0.04]">ลบเมื่อ</th>
                        <th className="px-5 py-4 border-b border-black/[0.04]">เหลือเวลา</th>
                      </>
                    ) : (
                      <th className="px-5 py-4 border-b border-black/[0.04]">สถานะ</th>
                    )}
                    <th className="px-5 py-4 border-b border-black/[0.04] text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-black/[0.04] transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
                {statusFilter === 'trash' ? (
                  filteredTrash.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#1d1d1f] text-[14px]">{t.name}</div>
                        <div className="text-[12.5px] text-[#6e6e73] mt-0.5">{t.email || t.username}</div>
                      </td>
                      <td className="px-5 py-4">
                        {t.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                            <ShieldAlert size={11} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/20">
                            <User size={11} /> User
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12.5px] font-medium text-[#6e6e73]">
                        {formatDateTime(t.deleted_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                          t.days_remaining <= 3
                            ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                            : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                        }`}>
                          {remainingLabel(t.days_remaining)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleRestore(t)}
                            disabled={trashBusyId === t.id}
                            aria-label={`กู้คืนผู้ใช้ ${displayLabel(t)}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0066cc]/10 px-3.5 py-1.5 text-[12px] font-bold text-[#0066cc] transition-all hover:bg-[#0066cc]/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {trashBusyId === t.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RotateCcw size={12} />
                            )}
                            กู้คืน
                          </button>
                          <button
                            onClick={() => handlePurge(t)}
                            disabled={trashBusyId === t.id}
                            aria-label={`ลบถาวร ${displayLabel(t)}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={12} /> ลบถาวร
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : users.map(u => {
                  const isSelf = currentUser?.id === u.id
                  return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#1d1d1f] text-[14px]">{u.name}</div>
                      <div className="text-[12.5px] text-[#6e6e73] mt-0.5">{u.email || u.username}</div>
                    </td>
                    <td className="px-5 py-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                          <ShieldAlert size={11} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/20">
                          <User size={11} /> User
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          ปกติ
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                          ระงับบัญชี
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button 
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-95"
                        >
                          <Settings size={12} /> ตั้งค่า
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={isSelf || deletingId === u.id}
                          title={isSelf ? 'ไม่สามารถลบบัญชีของตัวเองได้' : `ลบผู้ใช้ ${displayLabel(u)}`}
                          aria-label={`ลบผู้ใช้ ${displayLabel(u)}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-50"
                        >
                          {deletingId === u.id ? (
                            <>
                              <Loader2 size={12} className="animate-spin" /> กำลังลบ...
                            </>
                          ) : (
                            <>
                              <Trash2 size={12} /> ลบ
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {statusFilter === 'trash' ? (
                  filteredTrash.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-[13px] font-medium text-[#6e6e73]">
                        {isFetching ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={15} className="animate-spin text-[#0066cc]" /> กำลังโหลดข้อมูล...
                          </span>
                        ) : debouncedQuery.trim() ? (
                          'ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข'
                        ) : (
                          'ยังไม่มีบัญชีในถังขยะ'
                        )}
                      </td>
                    </tr>
                  )
                ) : (
                  users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-[13px] font-medium text-[#6e6e73]">
                        {isFetching ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={15} className="animate-spin text-[#0066cc]" /> กำลังโหลดข้อมูล...
                          </span>
                        ) : isFiltered ? (
                          'ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข'
                        ) : (
                          'ยังไม่มีผู้ใช้งานในระบบ'
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] border border-black/[0.06] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12.5px] font-medium text-[#6e6e73]">
              {statusFilter === 'trash'
                ? debouncedQuery.trim()
                  ? `พบ ${filteredTrash.length} บัญชีในถังขยะ`
                  : `${trash.length} บัญชีในถังขยะ`
                : Number.isNaN(total)
                  ? `หน้า ${page + 1}`
                  : `พบ ${total} บัญชี · หน้า ${page + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
            </span>
            {statusFilter !== 'trash' && (
              <div className="inline-flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setPage(prev => Math.max(0, prev - 1))}
                  disabled={page === 0}
                  aria-label="หน้าก่อนหน้า"
                  className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={13} /> ก่อนหน้า
                </button>
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={!hasNextPage}
                  aria-label="หน้าถัดไป"
                  className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ถัดไป <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
