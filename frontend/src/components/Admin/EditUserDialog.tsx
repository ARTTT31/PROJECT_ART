'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Lock, Shield, Eye, EyeOff, Loader2, UserCheck, Globe } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { showSuccess, showError } from '@/utils/sweetalert'
import { Dialog, DialogContent } from '@/components/ui/Dialog'

interface EditableUser {
  id: number
  email: string | null
  username: string | null
  display_name: string | null
  name: string
  role: string
  is_active: boolean
  is_locked: boolean
}

interface EditUserDialogProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: EditableUser | null
}

export default function EditUserDialog({ isOpen, onClose, onUserUpdated, user }: EditUserDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
    is_active: true,
    is_locked: false,
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Detect if user is a Google OAuth user (no username, has email with google pattern, or no hashed password indicator)
  // Simple heuristic: if username is null/empty, it's likely a Google OAuth user
  const isGoogleUser = user ? (!user.username || user.username === '') : false

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.display_name || user.name || '',
        email: user.email || '',
        role: user.role || 'user',
        is_active: user.is_active,
        is_locked: user.is_locked,
        password: '',
      })
      setErrors({})
      setShowPassword(false)
    }
  }, [user])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'ชื่อแสดงผลห้ามว่างเปล่า'
    }

    // Email validation (optional for non-google users)
    if (!isGoogleUser && formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    // Password validation (only if provided)
    if (!isGoogleUser && formData.password && formData.password.length < 8) {
      newErrors.password = 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !user) return

    setLoading(true)
    try {
      const updateData: Record<string, any> = {
        name: formData.name.trim(),
        role: formData.role,
        is_active: formData.is_active,
        is_locked: formData.is_locked,
      }

      // Only include email and password for non-Google users
      if (!isGoogleUser) {
        if (formData.email.trim()) {
          updateData.email = formData.email.trim()
        }
        if (formData.password) {
          updateData.password = formData.password
        }
      }

      await apiClient.put(`/users/${user.id}`, updateData)

      showSuccess('แก้ไขผู้ใช้สำเร็จ', `ข้อมูลของ ${formData.name} ถูกอัปเดตเรียบร้อยแล้ว`)
      onUserUpdated()
      onClose()
    } catch (error: any) {
      console.error('Error updating user:', error)
      const message = error.response?.data?.detail || 'เกิดข้อผิดพลาดในการแก้ไขผู้ใช้'
      showError('เกิดข้อผิดพลาด', message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="แก้ไขผู้ใช้งาน"
        description={isGoogleUser ? 'ผู้ใช้ Google OAuth — แก้ไขได้เฉพาะชื่อแสดงผลและสิทธิ์' : 'แก้ไขข้อมูลผู้ใช้ในระบบ'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Google OAuth Badge */}
          {isGoogleUser && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <Globe className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-blue-700">
                ผู้ใช้นี้สมัครผ่าน Google OAuth — ไม่สามารถแก้ไขอีเมลและรหัสผ่านได้
              </span>
            </div>
          )}

          {/* Display Name / Name */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                ชื่อแสดงผล
              </div>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (errors.name) setErrors({ ...errors, name: '' })
              }}
              disabled={loading}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 transition-all ${
                errors.name ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="เช่น สมชาย ใจดี"
            />
            {errors.name && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                <span aria-hidden="true">⚠️</span> {errors.name}
              </p>
            )}
          </div>

          {/* Email - disabled for Google users */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                อีเมล
                {isGoogleUser && <span className="text-xs text-slate-400 font-normal">(ไม่สามารถแก้ไขได้)</span>}
              </div>
            </label>
            <input
              type="text"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value })
                if (errors.email) setErrors({ ...errors, email: '' })
              }}
              disabled={loading || isGoogleUser}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500 transition-all ${
                errors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="เช่น user@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                <span aria-hidden="true">⚠️</span> {errors.email}
              </p>
            )}
          </div>

          {/* Password - hidden for Google users */}
          {!isGoogleUser && (
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                  รหัสผ่านใหม่
                  <span className="text-xs text-slate-400 font-normal">(เว้นว่างถ้าไม่ต้องการเปลี่ยน)</span>
                </div>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value })
                    if (errors.password) setErrors({ ...errors, password: '' })
                  }}
                  disabled={loading}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 pr-10 transition-all ${
                    errors.password ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
                  }`}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                  <span aria-hidden="true">⚠️</span> {errors.password}
                </p>
              )}
            </div>
          )}

          {/* Role & Status Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                สิทธิ์การใช้งาน
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-100 transition-all font-medium text-slate-800 cursor-pointer"
              >
                <option value="user">ผู้ใช้ทั่วไป (User)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                การเข้าถึงระบบ
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                disabled={loading}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-sm font-semibold transition-all ${
                  formData.is_active 
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700 hover:bg-emerald-50' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/70'
                }`}
              >
                <span>เปิดใช้งาน</span>
                <span className={`w-2 h-2 rounded-full ${formData.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                สถานะความปลอดภัย
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_locked: !formData.is_locked })}
                disabled={loading}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-sm font-semibold transition-all ${
                  formData.is_locked 
                    ? 'bg-red-50/60 border-red-200 text-red-700 hover:bg-red-50' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/70'
                }`}
              >
                <span>ล็อกบัญชี</span>
                <span className={`w-2 h-2 rounded-full ${formData.is_locked ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 sm:gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-600 font-bold tracking-wide transition-all hover:border-slate-300 disabled:opacity-50 active:scale-[0.98]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-xs sm:text-sm font-bold tracking-wide rounded-xl shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>บันทึกการเปลี่ยนแปลง</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
