'use client'

import { useState } from 'react'
import { User, Mail, Lock, Shield, Eye, EyeOff, Loader2, UserCheck } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { showSuccess, showError } from '@/utils/sweetalert'
import { Dialog, DialogContent } from '@/components/ui/Dialog'

interface CreateUserDialogProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

export default function CreateUserDialog({ isOpen, onClose, onUserCreated }: CreateUserDialogProps) {
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'ชื่อผู้ใช้ห้ามว่างเปล่า'
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร'
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) {
      newErrors.username = 'ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร ภาษาอังกฤษ ตัวเลข หรือเครื่องหมาย _ เท่านั้น'
    }

    // Display Name validation
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'ชื่อแสดงผลห้ามว่างเปล่า'
    }

    // Email validation (optional)
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'รหัสผ่านห้ามว่างเปล่า'
    } else if (formData.password.length < 8) {
      newErrors.password = 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'
    }

    // Confirm Password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    try {
      const response = await apiClient.post('/users/admin-create', {
        username: formData.username.trim(),
        display_name: formData.displayName.trim(),
        email: formData.email.trim() || null,
        password: formData.password,
        role: formData.role
      })

      showSuccess('สร้างผู้ใช้สำเร็จ', `ผู้ใช้ ${formData.username} ถูกสร้างเรียบร้อยแล้ว`)
      setFormData({
        username: '',
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user'
      })
      onUserCreated()
      onClose()
    } catch (error: any) {
      console.error('Error creating user:', error)
      const message = error.response?.data?.detail || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้'
      showError('เกิดข้อผิดพลาด', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="สร้างผู้ใช้งาน" description="เพิ่มผู้ใช้ใหม่เข้าสู่ระบบ">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Username */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                ชื่อผู้ใช้ (Username)
              </div>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => {
                setFormData({ ...formData, username: e.target.value })
                if (errors.username) setErrors({ ...errors, username: '' })
              }}
              disabled={loading}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 transition-all ${
                errors.username ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="เช่น username123"
            />
            {errors.username && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                <span aria-hidden="true">⚠️</span> {errors.username}
              </p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                ชื่อแสดงผล (Display Name)
              </div>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => {
                setFormData({ ...formData, displayName: e.target.value })
                if (errors.displayName) setErrors({ ...errors, displayName: '' })
              }}
              disabled={loading}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 transition-all ${
                errors.displayName ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="เช่น สมชาย ใจดี"
            />
            {errors.displayName && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                <span aria-hidden="true">⚠️</span> {errors.displayName}
              </p>
            )}
          </div>

          {/* Email (Optional) */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                อีเมล (ตัวเลือกเสริม)
              </div>
            </label>
            <input
              type="text"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value })
                if (errors.email) setErrors({ ...errors, email: '' })
              }}
              disabled={loading}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 transition-all ${
                errors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="เช่น user@example.com (ไม่ระบุก็ได้)"
            />
            {errors.email && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                <span aria-hidden="true">⚠️</span> {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                รหัสผ่าน
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

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                ยืนยันรหัสผ่าน
              </div>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value })
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' })
                }}
                disabled={loading}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 pr-10 transition-all ${
                  errors.confirmPassword ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
                }`}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                <span aria-hidden="true">⚠️</span> {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                สิทธิ์
              </div>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              disabled={loading}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-slate-200 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 transition-all bg-white"
            >
              <option value="user">ผู้ใช้ทั่วไป</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 sm:gap-3 pt-2 sm:pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 active:scale-95"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs sm:text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2"
            >
              {loading && <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
              <span>สร้าง</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
