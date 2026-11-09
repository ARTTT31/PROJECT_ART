'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import AuthPageShell from '@/components/Auth/AuthPageShell';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import '../../styles/pages/login.css';

const FORGOT_ENDPOINT = `${getApiBaseUrl()}/api/v1/auth/forgot-password`;

/**
 * Request a reset link.
 *
 * The API answers the same way for every address, so this page never learns
 * whether an account exists — the copy says "if this email has an account".
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(FORGOT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.detail || 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell tagline="ตั้งรหัสผ่านใหม่ด้วยอีเมล">
      {sent ? (
        <div className="login-form">
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">
              <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
              ส่งลิงก์แล้ว
            </span>
            หากอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว ลิงก์ใช้ได้ครั้งเดียวและหมดอายุ
            ใน 30 นาที
          </div>
          <p className="login-hint" style={{ textAlign: 'center' }}>
            ไม่ได้รับอีเมล? ตรวจโฟลเดอร์สแปม หรือรอ 1 นาทีแล้วลองอีกครั้ง
          </p>
          <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>กลับไปเข้าสู่ระบบ</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
          <label htmlFor="forgot-email" className="login-field">
            <span>อีเมลของบัญชี</span>
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
                disabled={submitting}
              />
            </div>
          </label>

          {error && (
            <div role="alert" aria-live="polite" className="login-error">
              <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="login-submit">
            {submitting ? (
              <>
                <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                <span>กำลังส่ง...</span>
              </>
            ) : (
              <>
                <span>ส่งลิงก์ตั้งรหัสผ่าน</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>

          <p className="login-hint" style={{ textAlign: 'center' }}>
            นึกออกแล้ว?{' '}
            <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </form>
      )}
    </AuthPageShell>
  );
}
