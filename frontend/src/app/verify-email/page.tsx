'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import AuthPageShell from '@/components/Auth/AuthPageShell';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import { useI18n } from '@/lib/i18n/I18nProvider';
import '../../styles/pages/login.css';

const apiBaseUrl = getApiBaseUrl();
const VERIFY_ENDPOINT = `${apiBaseUrl}/api/v1/auth/verify-email`;

type VerifyState = 'checking' | 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const { tr } = useI18n();
  const [state, setState] = useState<VerifyState>('checking');
  const [message, setMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('error');
      setMessage(
        tr(
          'ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ กรุณาติดต่อผู้ดูแลระบบ',
          'This verification link is invalid or has expired. Please contact your administrator',
        ),
      );
      return;
    }

    setState('verifying');
    fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            body.detail ||
              tr(
                'ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ กรุณาติดต่อผู้ดูแลระบบ',
                'This verification link is invalid or has expired. Please contact your administrator',
              ),
          );
        }
        setState('success');
      })
      .catch((error: Error) => {
        setState('error');
        setMessage(error.message);
      });
  }, [tr]);

  return (
    <AuthPageShell tagline={tr('ยืนยันอีเมลของคุณ', 'Verify your email')}>
      <div className="login-form">
        {(state === 'checking' || state === 'verifying') && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '20px 0',
            }}
          >
            <Loader2 size={26} className="login-submit-spinner" aria-hidden="true" />
            <span className="text-[var(--ink-tertiary)]" style={{ fontSize: 14 }}>
              {tr('กำลังยืนยันอีเมล...', 'Verifying email…')}
            </span>
          </div>
        )}

        {state === 'success' && (
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">
              <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
              {tr('ยืนยันอีเมลสำเร็จ', 'Email verified')}
            </span>
            {tr('บัญชีของคุณพร้อมใช้งานแล้ว เข้าสู่ระบบได้เลย', 'Your account is ready. You can sign in now.')}
          </div>
        )}

        {state === 'error' && (
          <div role="alert" aria-live="polite" className="login-error">
            <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
            {message}
          </div>
        )}

        {state === 'success' ? (
          <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
            <span>{tr('ไปหน้าเข้าสู่ระบบ', 'Go to sign in')}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          state === 'error' && (
            <>
              <Link href="/login" className="login-submit" style={{ textDecoration: 'none' }}>
                <span>{tr('กลับไปหน้าเข้าสู่ระบบ', 'Back to sign in')}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <p className="login-switch" style={{ textAlign: 'center', margin: 0 }}>
                {tr(
                  'หากลิงก์หมดอายุ กรุณาติดต่อผู้ดูแลระบบเพื่อขออีเมลยืนยันฉบับใหม่',
                  'If the link has expired, contact your administrator for a new verification email',
                )}
              </p>
            </>
          )
        )}
      </div>
    </AuthPageShell>
  );
}
