'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import AuthPageShell from '@/components/Auth/AuthPageShell'
import '../../styles/pages/login.css'

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
const RESET_ENDPOINT = `${apiBaseUrl}/api/v1/auth/reset-password`

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [tokenChecked, setTokenChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Read the token from the URL in an effect: the page is statically rendered,
  // and the token never reaches the server this way.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
    setTokenChecked(true)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านยืนยันไม่ตรงกัน')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(RESET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, new_password: password }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(
          result.detail ||
            'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่'
        )
        return
      }
      setDone(true)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthPageShell tagline="ตั้งรหัสผ่านใหม่สำเร็จ">
        <div className="login-form">
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">ตั้งรหัสผ่านใหม่เรียบร้อย</span>
            อุปกรณ์ที่เคยเข้าสู่ระบบไว้ถูกออกจากระบบทั้งหมดเพื่อความปลอดภัย
            กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
          </div>
          <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>ไปหน้าเข้าสู่ระบบ</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  if (tokenChecked && !token) {
    return (
      <AuthPageShell tagline="ลิงก์ไม่สมบูรณ์">
        <div className="login-form">
          <div role="alert" className="login-error">
            <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
            ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่
          </div>
          <Link href="/forgot-password" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>ขอลิงก์ตั้งรหัสผ่านใหม่</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/login" className="login-switch">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  if (!tokenChecked) {
    return (
      <AuthPageShell tagline="กำลังตรวจสอบลิงก์...">
        <div className="login-form">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Loader2 size={26} className="login-submit-spinner" aria-label="กำลังโหลด" />
          </div>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell tagline="ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ">
      <form onSubmit={handleSubmit} className="login-form" aria-busy={isSubmitting}>
        <label htmlFor="reset-password" className="login-field">
          <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span>
          <div className="login-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              className="login-eye"
              disabled={isSubmitting}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </label>

        <label htmlFor="reset-confirm" className="login-field">
          <span>ยืนยันรหัสผ่านใหม่</span>
          <div className="login-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input
              id="reset-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>
        </label>

        {confirmPassword && password === confirmPassword && (
          <p className="login-hint" style={{ color: '#1a7f37' }}>
            <CheckCircle2 size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
            รหัสผ่านยืนยันตรงกัน
          </p>
        )}

        {error && (
          <div role="alert" aria-live="polite" className="login-error">
            <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="login-submit">
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <>
              <span>ตั้งรหัสผ่านใหม่</span>
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>

        <Link href="/login" className="login-switch">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </form>
    </AuthPageShell>
  )
}
