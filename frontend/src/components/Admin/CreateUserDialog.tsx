'use client'

import { useState } from 'react'
import { X, User, Mail, Lock, Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { showSuccess, showError } from '@/utils/sweetalert'

interface CreateUserDialogProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

export default function CreateUserDialog({ isOpen, onClose, onUserCreated }: CreateUserDialogProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
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

    if (!formData.email.trim()) {
      newErrors.email = 'อีเมลไม่ว่างเปล่า'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'ชื่อไม่ว่างเปล่า'
    }

    if (!formData.password) {
      newErrors.password = 'รหัสผ่านไม่ว่างเปล่า'
    } else if (formData.password.length < 8) {
      newErrors.password = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'
    }

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
      const response = await apiClient.post('/users', {
        email: formData.email.trim(),
        name: formData.name.trim(),
        password: formData.password,
        role: formData.role
      })

      showSuccess('สร้างผู้ใช้สำเร็จ', `ผู้ใช้ ${formData.email} ถูกสร้างเรียบร้อยแล้ว`)
      setFormData({ email: '', name: '', password: '', confirmPassword: '', role: 'user' })
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md lg:max-w-lg overflow-hidden transform transition-all duration-300 hover:shadow-3xl my-auto">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-md border border-white/30 hover:scale-110 transition-transform flex-shrink-0">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold text-white truncate">สร้างผู้ใช้งาน</h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">เพิ่มผู้ใช้ใหม่เข้าสู่ระบบ</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50 backdrop-blur-md border border-white/20 hover:border-white/40 flex-shrink-0"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[calc(100vh-200px)] sm:max-h-none overflow-y-auto">
          {/* Email */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                อีเมล
              </div>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value })
                if (errors.email) setErrors({ ...errors, email: '' })
              }}
              disabled={loading}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 transition-all ${
                errors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
              }`}
              placeholder="user@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs font-medium flex items-center gap-1"><span>⚠️</span> {errors.email}</p>}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                ชื่อ
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
              placeholder="ชื่อผู้ใช้"
            />
            {errors.name && <p className="text-red-500 text-xs font-medium flex items-center gap-1"><span>⚠️</span> {errors.name}</p>}
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
            {errors.password && <p className="text-red-500 text-xs font-medium flex items-center gap-1"><span>⚠️</span> {errors.password}</p>}
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
            {errors.confirmPassword && <p className="text-red-500 text-xs font-medium flex items-center gap-1"><span>⚠️</span> {errors.confirmPassword}</p>}
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
      </div>
    </div>
  )
}
