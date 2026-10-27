'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Loader2, Mail } from 'lucide-react'
import AuthPageShell from '@/components/Auth/AuthPageShell'
import TurnstileWidget from '@/components/Auth/TurnstileWidget'
import '../../styles/pages/login.css'

// Always use same-origin in the browser so requests go through the Next.js
// rewrite proxy and cookies are first-party.
const apiBaseUrl = ''
const FORGOT_ENDPOINT = `${apiBaseUrl}/api/v1/auth/forgot-password`

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(FORGOT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(result.detail || 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
        return
      }
      // The API answers the same way whether or not the address exists — the
      // screen must not undo that by behaving differently.
      setSent(true)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthPageShell tagline="ตรวจสอบอีเมลของคุณ">
        <div className="login-form">
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">ส่งลิงก์แล้ว</span>
            ถ้าอีเมล <strong>{email.trim()}</strong> มีบัญชีอยู่ในระบบ
            เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมาย
            (รวมถึงโฟลเดอร์สแปม) ภายใน 30 นาที
          </div>
          <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>กลับไปหน้าเข้าสู่ระบบ</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell tagline="ลืมรหัสผ่าน? ให้เราช่วยคุณกลับเข้าใช้งาน">
      <form onSubmit={handleSubmit} className="login-form" aria-busy={isSubmitting}>
        <p className="login-hint">
          กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
        </p>

        <label htmlFor="forgot-email" className="login-field">
          <span>อีเมล</span>
          <div className="login-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>
        </label>

        <TurnstileWidget onToken={setTurnstileToken} />

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
              <span>กำลังส่ง...</span>
            </>
          ) : (
            <>
              <span>ส่งลิงก์ตั้งรหัสผ่านใหม่</span>
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
