'use client'

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { useToast } from '@/components/Toast/ToastProvider'
import {
  Users, Shield, Settings, AlertCircle, Edit, Check, X, ShieldAlert
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
    return <div className="p-4 text-center text-sm text-slate-500">กำลังโหลดรายชื่อผู้ใช้...</div>
  }

  return (
    <div className="space-y-4">
      {editingUser ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit size={16} className="text-blue-500" />
                แก้ไขผู้ใช้งาน: {editingUser.name}
              </h3>
              <p className="text-xs text-slate-500">{editingUser.email || editingUser.username}</p>
            </div>
            <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">สถานะการใช้งาน</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm">เปิดใช้งานบัญชี (Active)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">สิทธิ์การใช้งาน (Role)</label>
              <select 
                value={editRole} 
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full sm:w-64 rounded-lg border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">หน้าที่สามารถเข้าถึงได้ (Accessible Pages)</label>
              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {AVAILABLE_PAGES.map(page => (
                  <label key={page.id} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={editPages.includes(page.id)}
                      onChange={() => togglePage(page.id)}
                      className="rounded text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm">{page.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button 
                onClick={closeEdit}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? 'กำลังบันทึก...' : <><Check size={16} /> บันทึกการแก้ไข</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">ชื่อผู้ใช้</th>
                <th className="px-4 py-3 font-medium">สิทธิ์</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email || u.username}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                        <ShieldAlert size={12} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
                        <User size={12} /> User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        ปกติ
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                        ระงับ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Settings size={14} /> ตั้งค่า
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const User = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)
