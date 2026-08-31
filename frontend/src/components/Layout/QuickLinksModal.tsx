'use client'

import { useState, useEffect } from 'react'
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
  QuickLink,
  QuickLinkIconKey,
  QUICK_LINK_ICON_MAP,
  QUICK_LINK_ICON_OPTIONS,
  serializeQuickLinks,
} from '@/utils/quickLinks'
import {
  Plus,
  Trash2,
  ExternalLink,
  Globe,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { showToast } from '@/utils/sweetalert'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { useAuth } from '@/hooks/useAuth'

interface QuickLinksModalProps {
  isOpen: boolean
  onClose: () => void
  initialLinks: QuickLink[]
  onSave: (links: QuickLink[]) => void
}

const COLOR_OPTIONS = [
  { label: 'ฟ้า (Sky)', value: '#0ea5e9' },
  { label: 'น้ำเงิน (Blue)', value: '#0071e3' },
  { label: 'เขียว (Emerald)', value: '#10b981' },
  { label: 'ม่วง (Purple)', value: '#8b5cf6' },
  { label: 'ส้ม (Amber)', value: '#f59e0b' },
  { label: 'แดง (Rose)', value: '#f43f5e' },
  { label: 'เทาเข้ม (Slate)', value: '#475569' },
]

const DEFAULT_LINKS: QuickLink[] = [
  {
    id: 'ql-salesforce',
    label: 'Salesforce',
    url: 'https://salesforce.com',
    icon: 'briefcase',
    color: '#0071e3',
  },
  {
    id: 'ql-onebook',
    label: 'OneBook HR',
    url: 'https://onebook.co.th',
    icon: 'users',
    color: '#0ea5e9',
  },
  {
    id: 'ql-zebra',
    label: 'Zebra Learning',
    url: 'https://learning.zebra.com',
    icon: 'book',
    color: '#10b981',
  },
]

export default function QuickLinksModal({
  isOpen,
  onClose,
  initialLinks,
  onSave,
}: QuickLinksModalProps) {
  const { updateUser } = useAuth()
  const [links, setLinks] = useState<QuickLink[]>(initialLinks)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form states
  const [formLabel, setFormLabel] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formIcon, setFormIcon] = useState<QuickLinkIconKey>('link')
  const [formColor, setFormColor] = useState<string>('#0071e3')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLinks(initialLinks.length > 0 ? initialLinks : DEFAULT_LINKS)
      setIsAdding(false)
      setEditingId(null)
      resetForm()
    }
  }, [isOpen, initialLinks])

  const resetForm = () => {
    setFormLabel('')
    setFormUrl('')
    setFormIcon('link')
    setFormColor('#0071e3')
  }

  const handleStartAdd = () => {
    resetForm()
    setEditingId(null)
    setIsAdding(true)
  }

  const handleStartEdit = (link: QuickLink) => {
    setFormLabel(link.label)
    setFormUrl(link.url)
    setFormIcon(link.icon)
    setFormColor(link.color || '#0071e3')
    setEditingId(link.id)
    setIsAdding(true)
  }

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formLabel.trim()) {
      showToast('กรุณาระบุชื่อลิงก์', 'warning')
      return
    }

    let formattedUrl = formUrl.trim()
    if (!formattedUrl) {
      showToast('กรุณาระบุ URL', 'warning')
      return
    }

    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`
    }

    if (editingId) {
      setLinks((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                label: formLabel.trim(),
                url: formattedUrl,
                icon: formIcon,
                color: formColor,
              }
            : item,
        ),
      )
    } else {
      const newLink: QuickLink = {
        id: `ql_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: formLabel.trim(),
        url: formattedUrl,
        icon: formIcon,
        color: formColor,
      }
      setLinks((prev) => [...prev, newLink])
    }

    setIsAdding(false)
    setEditingId(null)
    resetForm()
  }

  const handleDeleteLink = (id: string) => {
    setLinks((prev) => prev.filter((item) => item.id !== id))
  }

  const handleResetDefaults = () => {
    setLinks(DEFAULT_LINKS)
    showToast('รีเซ็ตเป็นลิงก์เริ่มต้นแล้ว', 'info')
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    const serialized = serializeQuickLinks(links)

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('artQuickLinksV2', serialized)
      }

      // Sync to backend user profile
      await fetchWithAuth('/api/v1/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quick_links: serialized }),
      }).catch((err) => console.warn('Could not sync quick links to profile:', err))

      updateUser({ quick_links: serialized })
      onSave(links)
      showToast('บันทึกลิงก์ด่วนเรียบร้อยแล้ว', 'success')
      onClose()
    } catch {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#0071e3]">
                <Globe size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  ปรับแต่งควิกลิ้งค์ (Quick Links)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  จัดการเมนูลัดเว็บไซต์ที่คุณใช้งานบ่อยในแถบเมนูซ้าย
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          {/* Add / Edit Form */}
          {isAdding ? (
            <form onSubmit={handleSaveForm} className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {editingId ? 'แก้ไขลิงก์ด่วน' : 'เพิ่มลิงก์ด่วนใหม่'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-700"
                >
                  ยกเลิก
                </button>
              </div>

              {/* Label */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ชื่อที่ต้องการแสดง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="เช่น GitHub, Canva, HR Portal"
                  className="w-full rounded-xl bg-white px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  required
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ลิงก์ URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-white px-3 py-2 text-xs text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  required
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เลือกไอคอน
                </label>
                <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto rounded-xl bg-white p-2 ring-1 ring-slate-200">
                  {QUICK_LINK_ICON_OPTIONS.map(({ key }) => {
                    const IconComp = QUICK_LINK_ICON_MAP[key]
                    const isSelected = formIcon === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormIcon(key)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                          isSelected
                            ? 'bg-[#0071e3] text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title={key}
                      >
                        <IconComp size={16} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  สีไอคอน
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => {
                    const isSelected = formColor === c.value
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setFormColor(c.value)}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform ${
                          isSelected ? 'ring-2 ring-offset-2 ring-[#0071e3] scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-[#0071e3] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0077ed]"
                >
                  {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มลิงก์'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleStartAdd}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors"
            >
              <Plus size={15} className="text-[#0071e3]" />
              <span>เพิ่มลิงก์ด่วนใหม่</span>
            </button>
          )}

          {/* Links List */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              รายการลิงก์ปัจจุบัน ({links.length})
            </span>

            {links.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-6 text-center text-xs text-slate-400">
                ยังไม่มีลิงก์ด่วน — กดปุ่มด้านบนเพื่อเพิ่ม
              </div>
            ) : (
              links.map((link) => {
                const Icon = QUICK_LINK_ICON_MAP[link.icon] || Globe
                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 transition-colors hover:bg-slate-50/80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100"
                        style={{ color: link.color || '#0071e3' }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {link.label}
                          </span>
                          <ExternalLink size={10} className="text-slate-400 shrink-0" />
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {link.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(link)}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(link.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="ลบลิงก์นี้"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogBody>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-slate-100 p-4 bg-slate-50/50">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <RotateCcw size={13} />
            <span>รีเซ็ตค่าเริ่มต้น</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0077ed] active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles size={13} />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
