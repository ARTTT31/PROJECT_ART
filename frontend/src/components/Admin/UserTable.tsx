'use client'

import { useState, useEffect } from 'react'
import { Trash2, Lock, Unlock, CheckCircle2, AlertCircle, Mail, User, Pencil, Globe } from 'lucide-react'
import { showConfirm, showSuccess, showError } from '@/utils/sweetalert'

interface UserData {
  id: number
  email: string | null
  username: string | null
  display_name: string | null
  name: string
  role: string
  is_active: boolean
  is_locked: boolean
  last_login?: string
  created_at: string
}

interface UserTableProps {
  users: UserData[]
  onEditUser?: (user: UserData) => void
}

export default function UserTable({ users, onEditUser }: UserTableProps) {
  const [loading, setLoading] = useState(false)
  const [localUsers, setLocalUsers] = useState(users)

  useEffect(() => {
    console.log('📊 UserTable received users:', users.length);
    setLocalUsers(users)
  }, [users])

  const handleDelete = async (userId: number, userName: string) => {
    const result = await showConfirm(
      'ลบผู้ใช้?',
      `คุณแน่ใจที่ต้องการลบผู้ใช้ ${userName} หรือไม่?`
    )
    
    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const { apiClient } = await import('@/lib/api/client');
      await apiClient.delete(`/users/${userId}`)
      setLocalUsers(localUsers.filter(u => u.id !== userId))
      showSuccess('ลบผู้ใช้สำเร็จ', `ผู้ใช้ ${userName} ถูกลบเรียบร้อยแล้ว`)
    } catch (error) {
      console.error('Error deleting user:', error)
      showError('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบผู้ใช้')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleLock = async (userId: number, isLocked: boolean, userName: string) => {
    const result = await showConfirm(
      isLocked ? 'ปลดล็อคผู้ใช้?' : 'ล็อคผู้ใช้?',
      isLocked 
        ? `คุณแน่ใจที่ต้องการปลดล็อค ${userName} หรือไม่?`
        : `คุณแน่ใจที่ต้องการล็อค ${userName} หรือไม่?`
    )
    
    if (!result.isConfirmed) return

    setLoading(true)
    try {
      const { apiClient } = await import('@/lib/api/client');
      await apiClient.put(`/users/${userId}`, { is_locked: !isLocked })
      setLocalUsers(localUsers.map(u => 
        u.id === userId ? { ...u, is_locked: !isLocked } : u
      ))
      showSuccess(
        isLocked ? 'ปลดล็อคสำเร็จ' : 'ล็อคสำเร็จ',
        `${userName} ได้${isLocked ? 'ปลดล็อค' : 'ล็อค'}เรียบร้อยแล้ว`
      )
    } catch (error) {
      console.error('Error updating user:', error)
      showError('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการอัพเดตผู้ใช้')
    } finally {
      setLoading(false)
    }
  }

  // Detect if user is Google OAuth (no username)
  const isGoogleUser = (user: UserData) => !user.username || user.username === ''

  // Get display identifier for the user
  const getDisplayName = (user: UserData) => user.display_name || user.name

  if (!localUsers || localUsers.length === 0) {
    return (
      <div className="p-12 text-center">
        <Mail className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">ไม่พบผู้ใช้</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">ผู้ใช้</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">อีเมล</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">บทบาท</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">สถานะ</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">เข้าสุดท้าย</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {localUsers.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isGoogleUser(user) 
                      ? 'bg-gradient-to-br from-red-50 to-orange-50' 
                      : 'bg-gradient-to-br from-sky-100 to-blue-100'
                  }`}>
                    {isGoogleUser(user) 
                      ? <Globe size={18} className="text-red-500" />
                      : <User size={18} className="text-blue-600" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{getDisplayName(user)}</div>
                    {user.username && (
                      <div className="text-xs text-slate-400 truncate">@{user.username}</div>
                    )}
                    {isGoogleUser(user) && (
                      <div className="text-[10px] text-orange-500 font-semibold">Google OAuth</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600 text-sm">{user.email || '—'}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  user.role === 'admin' 
                    ? 'bg-amber-100/50 text-amber-700 border border-amber-200' 
                    : 'bg-blue-100/50 text-blue-700 border border-blue-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-amber-600' : 'bg-blue-600'}`} />
                  {user.role === 'admin' ? 'ผู้ดูแล' : 'ผู้ใช้'}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {user.is_locked && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100/50 text-red-700 border border-red-200">
                      <AlertCircle size={14} />
                      ล็อค
                    </span>
                  )}
                  {user.is_active && !user.is_locked && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100/50 text-green-700 border border-green-200">
                      <CheckCircle2 size={14} />
                      ใช้งาน
                    </span>
                  )}
                  {!user.is_active && !user.is_locked && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100/50 text-slate-700 border border-slate-200">
                      ปิดใช้งาน
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {user.last_login 
                  ? new Date(user.last_login).toLocaleDateString('th-TH', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'ไม่เคยเข้า'
                }
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1.5">
                  {/* Edit button */}
                  {onEditUser && (
                    <button
                      onClick={() => onEditUser(user)}
                      disabled={loading}
                      className="p-2.5 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors disabled:opacity-50"
                      title="แก้ไขผู้ใช้"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  {/* Lock/Unlock button */}
                  <button
                    onClick={() => handleToggleLock(user.id, user.is_locked, getDisplayName(user))}
                    disabled={loading}
                    className="p-2.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors disabled:opacity-50"
                    title={user.is_locked ? 'ปลดล็อค' : 'ล็อค'}
                  >
                    {user.is_locked ? <Unlock size={18} /> : <Lock size={18} />}
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(user.id, getDisplayName(user))}
                    disabled={loading}
                    className="p-2.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors disabled:opacity-50"
                    title="ลบผู้ใช้"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
