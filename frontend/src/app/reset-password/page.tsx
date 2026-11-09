'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock } from 'lucide-react';
import AuthPageShell from '@/components/Auth/AuthPageShell';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import '../../styles/pages/login.css';

const RESET_ENDPOINT = `${getApiBaseUrl()}/api/v1/auth/reset-password`;

/**
 * Redeem the emailed reset link.
 *
 * The token is read from the query string (never rendered) and the API marks
 * it used before changing the password. A successful reset revokes every
 * session on the server, so the user must sign in again.
 */
export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  // The link is only in the query string, which is unavailable during
  // prerender. Rendering nothing until hydration avoids both a hydration
  // mismatch and a flash of "invalid link".
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
    setReady(true);
  }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(RESET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.detail || 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell tagline="ตั้งรหัสผ่านใหม่">
      {!ready ? (
        <div className="login-form" role="status" aria-live="polite">
          <Loader2 size={26} className="login-submit-spinner" aria-hidden="true" />
        </div>
      ) : !token ? (
        <div className="login-form">
          <div className="login-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
            ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว
          </div>
          <Link href="/forgot-password" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>ขอลิงก์ใหม่</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : done ? (
        <div className="login-form">
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">
              <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
              ตั้งรหัสผ่านใหม่สำเร็จ
            </span>
            อุปกรณ์ทั้งหมดถูกออกจากระบบแล้ว เข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่
          </div>
          <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>ไปหน้าเข้าสู่ระบบ</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
          <label htmlFor="reset-password" className="login-field">
            <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span>
            <div className="login-input-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>
          </label>

          <label htmlFor="reset-confirm" className="login-field">
            <span>ยืนยันรหัสผ่านใหม่</span>
            <div className="login-input-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
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
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <span>ตั้งรหัสผ่านใหม่</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
