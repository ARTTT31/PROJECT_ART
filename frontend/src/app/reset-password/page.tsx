'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock } from 'lucide-react';
import AuthPageShell from '@/components/Auth/AuthPageShell';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import { useI18n } from '@/lib/i18n/I18nProvider';
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
  const { tr } = useI18n();
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
      setError(tr('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'The two passwords do not match'));
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
        throw new Error(
          body?.detail || tr('ตั้งรหัสผ่านใหม่ไม่สำเร็จ', 'Could not reset the password'),
        );
      }
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tr('ตั้งรหัสผ่านใหม่ไม่สำเร็จ', 'Could not reset the password'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell tagline={tr('ตั้งรหัสผ่านใหม่', 'Reset password')}>
      {!ready ? (
        <div className="login-form" role="status" aria-live="polite">
          <Loader2 size={26} className="login-submit-spinner" aria-hidden="true" />
        </div>
      ) : !token ? (
        <div className="login-form">
          <div className="login-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
            {tr('ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว', 'This reset link is invalid or has expired')}
          </div>
          <Link href="/forgot-password" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>{tr('ขอลิงก์ใหม่', 'Request a new link')}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : done ? (
        <div className="login-form">
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">
              <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
              {tr('ตั้งรหัสผ่านใหม่สำเร็จ', 'Password reset')}
            </span>
            {tr(
              'อุปกรณ์ทั้งหมดถูกออกจากระบบแล้ว เข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่',
              'All devices have been signed out. Sign in again with your new password.',
            )}
          </div>
          <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>{tr('ไปหน้าเข้าสู่ระบบ', 'Go to sign in')}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
          <label htmlFor="reset-password" className="login-field">
            <span>{tr('รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)', 'New password (at least 8 characters)')}</span>
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
            <span>{tr('ยืนยันรหัสผ่านใหม่', 'Confirm new password')}</span>
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
                <span>{tr('กำลังบันทึก...', 'Saving…')}</span>
              </>
            ) : (
              <>
                <span>{tr('ตั้งรหัสผ่านใหม่', 'Reset password')}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
