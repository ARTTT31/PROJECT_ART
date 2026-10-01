'use client'

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { useToast } from '@/components/Toast/ToastProvider'
import {
  Users, Shield, Settings, Edit, Check, X, ShieldAlert, User, CheckCircle2, Circle
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
}

const AVAILABLE_PAGES = [
  { id: 'dashboard', label: 'หน้าหลัก (Dashboard)' },
  { id: 'profile', label: 'หน้าโปรไฟล์ (Profile)' },
  { id: 'camera', label: 'กล้อง (Camera)' },
]

export default function UserManagement() {
  const { success: showSuccess, error: showError, info: showToast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  
  const [editRole, setEditRole] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editPages, setEditPages] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/v1/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else {
        showError('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

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

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {editingUser ? (
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(15,23,42,0.07)]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/[0.04] bg-[#fbfbfc] px-6 py-5">
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0071e3]/10 text-[#0071e3]">
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
                  <CheckCircle2 size={22} className="text-[#0071e3]" />
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
                      ? 'bg-white ring-2 ring-[#0071e3] shadow-[0_4px_12px_rgba(0,113,227,0.12)]' 
                      : 'bg-[#f8fafc] ring-1 ring-black/[0.04] hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    editRole === 'user' ? 'bg-[#0071e3] text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                  }`}>
                    <User size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className={`block text-[14px] font-semibold transition-colors ${
                      editRole === 'user' ? 'text-[#0071e3]' : 'text-[#1d1d1f]'
                    }`}>ผู้ใช้งานทั่วไป (User)</span>
                    <span className="block mt-0.5 text-[12px] text-[#6e6e73] leading-relaxed">เข้าถึงเฉพาะฟีเจอร์ที่ได้รับอนุญาต</span>
                  </div>
                  {editRole === 'user' && (
                    <div className="absolute right-4 top-4 text-[#0071e3] animate-in zoom-in duration-200">
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
                        <CheckCircle2 size={20} className="text-[#0071e3]" />
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
              className="w-full sm:w-auto rounded-full bg-[#f5f5f7] px-5 py-2.5 text-[13px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-[0.98]"
            >
              ยกเลิก
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0071e3] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_3px_12px_rgba(0,113,227,0.32)] active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? 'กำลังบันทึก...' : <><Check size={14} /> บันทึกการแก้ไข</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#fbfbfc] text-[#6e6e73] text-[12px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4 border-b border-black/[0.04]">ชื่อผู้ใช้</th>
                  <th className="px-5 py-4 border-b border-black/[0.04]">สิทธิ์</th>
                  <th className="px-5 py-4 border-b border-black/[0.04]">สถานะ</th>
                  <th className="px-5 py-4 border-b border-black/[0.04] text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {users.map(u => (
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
                      <button 
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-bold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] active:scale-95"
                      >
                        <Settings size={12} /> ตั้งค่า
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
