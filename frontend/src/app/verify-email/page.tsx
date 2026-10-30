'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import AuthPageShell from '@/components/Auth/AuthPageShell';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import '../../styles/pages/login.css';

const apiBaseUrl = getApiBaseUrl();
const VERIFY_ENDPOINT = `${apiBaseUrl}/api/v1/auth/verify-email`;

type VerifyState = 'checking' | 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerifyState>('checking');
  const [message, setMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('error');
      setMessage('ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ กรุณาขออีเมลยืนยันฉบับใหม่');
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
            body.detail || 'ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ กรุณาขออีเมลยืนยันฉบับใหม่',
          );
        }
        setState('success');
      })
      .catch((error: Error) => {
        setState('error');
        setMessage(error.message);
      });
  }, []);

  return (
    <AuthPageShell tagline="ยืนยันอีเมลของคุณ">
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
            <span style={{ color: '#6e6e73', fontSize: 14 }}>กำลังยืนยันอีเมล...</span>
          </div>
        )}

        {state === 'success' && (
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">
              <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
              ยืนยันอีเมลสำเร็จ
            </span>
            บัญชีของคุณพร้อมใช้งานแล้ว เข้าสู่ระบบได้เลย
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
            <span>ไปหน้าเข้าสู่ระบบ</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          state === 'error' && (
            <>
              <Link
                href="/forgot-password"
                className="login-submit"
                style={{ textDecoration: 'none' }}
              >
                <span>ขอลิงก์ยืนยันใหม่</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/login" className="login-switch">
                กลับไปหน้าเข้าสู่ระบบ
              </Link>
            </>
          )
        )}
      </div>
    </AuthPageShell>
  );
}
