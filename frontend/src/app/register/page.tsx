'use client';

import '@/styles/pages/login.css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/context/BrandingContext';
import TurnstileWidget from '@/components/Auth/TurnstileWidget';
import ApprovalPending from '@/components/Auth/ApprovalPending';
import AuthTransitionOverlay from '@/components/Auth/AuthTransitionOverlay';
import { useToast } from '@/components/Toast/ToastProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getApiBaseUrl } from '@/lib/api/apiBase';

/** Thai date, short month (e.g. "วันพฤหัสบดีที่ 9 ต.ค. 2569") */
const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const formatDate = (date: Date) => dateFormatter.format(date);
const formatTime = (date: Date) => timeFormatter.format(date);

const apiBaseUrl = getApiBaseUrl();
const REGISTER_ENDPOINT = `${apiBaseUrl}/api/v1/auth/register`;
const REGISTRATION_MODE_ENDPOINT = `${apiBaseUrl}/api/v1/auth/registration-mode`;

type RegistrationMode = 'closed' | 'approval' | 'open';

export default function RegisterPage() {
  const { status } = useAuth();
  const { companyName, companyTagline, brandLogoUrl } = useBranding();
  const { tr } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [registrationMode, setRegistrationMode] = useState<RegistrationMode | null>(null);
  const [isCheckingMode, setIsCheckingMode] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [capsLock, setCapsLock] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPendingSuccess, setIsPendingSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [signUpDone, setSignUpDone] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const nameRef = useRef<HTMLInputElement>(null);

  // Already signed in? Go straight to dashboard.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  // Clock tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((previous) => {
        const next = new Date();
        return formatTime(next) === formatTime(previous) ? previous : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Open-mode sign-ups hand off to the sign-in form with a short success beat
  // instead of an instant cut to another page.
  useEffect(() => {
    if (!signUpDone) return;
    const timer = window.setTimeout(() => router.push('/login'), 850);
    return () => window.clearTimeout(timer);
  }, [signUpDone, router]);

  // Fetch registration mode from server
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(REGISTRATION_MODE_ENDPOINT, {
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) {
          const mode = body?.data?.registration_mode as RegistrationMode | undefined;
          setRegistrationMode(mode || 'approval');
          setIsCheckingMode(false);
          if (mode === 'approval' || mode === 'open') {
            setTimeout(() => nameRef.current?.focus(), 60);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrationMode('approval');
          setIsCheckingMode(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleCapsLock = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.getModifierState) {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError(tr('กรุณากรอกชื่อที่แสดง', 'Please enter a display name'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(tr('กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง', 'Please check the email format and try again'));
      return;
    }
    if (password.length < 8) {
      setError(tr('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'Password must be at least 8 characters'));
      return;
    }
    if (password !== confirmPassword) {
      setError(tr('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', 'The passwords do not match'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          result.detail ||
            result.message ||
            tr('สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'Sign-up failed. Please try again'),
        );
        return;
      }

      setRegisteredEmail(trimmedEmail);

      if (registrationMode === 'approval') {
        setIsPendingSuccess(true);
        return;
      }

      // Open mode: account works immediately
      toast.success(
        tr('สมัครสมาชิกสำเร็จ', 'Account created'),
        tr('กรุณาเข้าสู่ระบบด้วยบัญชีที่สร้างใหม่', 'Please sign in with your new account'),
      );
      setSignUpDone(true);
    } catch (err) {
      console.error('Registration submit error:', err);
      setError(tr('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง', 'Connection error. Please try again'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveLogo = brandLogoUrl || '/art-workspace-mark.svg';

  return (
    <main className="login-page">
      <section
        aria-label={tr('สมัครสมาชิก {name}', 'Sign up for {name}', { name: companyName })}
        className="login-shell"
      >
        <div className="login-panel">
          {/* Header */}
          <header className="login-brand">
            <Image
              src={effectiveLogo}
              alt={companyName}
              width={72}
              height={72}
              priority
              draggable={false}
              className="login-mark"
            />
            <h1 className="login-title">{companyName}</h1>
            <p className="login-tagline">
              {companyTagline ||
                tr('สมัครสมาชิกเพื่อเริ่มต้นใช้งานแดชบอร์ด', 'Sign up to start using the dashboard')}
            </p>
            <p className="login-clock">
              <Clock size={15} strokeWidth={2} aria-hidden="true" className="login-clock-icon" />
              <time
                suppressHydrationWarning
                className="login-clock-time"
                dateTime={now.toISOString()}
              >
                {tr('{time} น.', '{time}', { time: formatTime(now) })}
              </time>
              <span aria-hidden="true" className="login-clock-sep">
                •
              </span>
              <span className="login-clock-date">{formatDate(now)}</span>
            </p>
          </header>

          {/* Loading mode state */}
          {isCheckingMode ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin text-[var(--accent-text)]" />
              <p className="text-[13px] text-[var(--ink-tertiary)]">
                {tr('กำลังตรวจสอบระบบการรับสมัคร...', 'Checking registration status…')}
              </p>
            </div>
          ) : isPendingSuccess ? (
            /* Success awaiting approval state */
            <ApprovalPending email={registeredEmail} onBack={() => router.push('/login')} />
          ) : registrationMode === 'closed' ? (
            /* Registration closed state */
            <div className="auth-state" role="status">
              <span className="auth-state-icon auth-state-icon--neutral" aria-hidden="true">
                <Lock size={28} strokeWidth={2.1} />
              </span>
              <h2 className="auth-state-title">
                {tr('ปิดรับสมัครสมาชิกชั่วคราว', 'Sign-ups are temporarily closed')}
              </h2>
              <p className="auth-state-text">
                {tr(
                  'ระบบนี้กำหนดให้เฉพาะผู้ดูแลระบบสร้างบัญชีให้เท่านั้น หากต้องการใช้งานกรุณาติดต่อผู้ดูแลระบบของคุณ',
                  'This deployment only allows administrators to create accounts. Contact your administrator to get access.',
                )}
              </p>
              <div className="auth-actions">
                <Link href="/login" className="login-submit">
                  <span>{tr('เข้าสู่ระบบด้วยบัญชีที่มีอยู่', 'Sign in with an existing account')}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form
              onSubmit={handleSubmit}
              className="login-form login-view-enter"
              aria-busy={isSubmitting}
            >
              <label htmlFor="reg-name" className="login-field">
                <span>{tr('ชื่อที่แสดง', 'Display name')}</span>
                <div className="login-input-wrap">
                  <User size={18} aria-hidden="true" />
                  <input
                    id="reg-name"
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={tr('เช่น สมชาย ใจดี หรือ ทีมงาน', 'e.g. Alex Smith or Design Team')}
                    required
                    autoComplete="name"
                    disabled={isSubmitting}
                  />
                </div>
              </label>

              <label htmlFor="reg-email" className="login-field">
                <span>{tr('อีเมล', 'Email')}</span>
                <div className="login-input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                </div>
              </label>

              <label htmlFor="reg-password" className="login-field">
                <span>{tr('รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)', 'Password (at least 8 characters)')}</span>
                <div className="login-input-wrap">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleCapsLock}
                    onKeyUp={handleCapsLock}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  {capsLock && <span className="login-caps">Caps</span>}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? tr('ซ่อนรหัสผ่าน', 'Hide password')
                        : tr('แสดงรหัสผ่าน', 'Show password')
                    }
                    className="login-eye"
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label htmlFor="reg-confirm-password" className="login-field">
                <span>{tr('ยืนยันรหัสผ่าน', 'Confirm password')}</span>
                <div className="login-input-wrap">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword
                        ? tr('ซ่อนรหัสผ่าน', 'Hide password')
                        : tr('แสดงรหัสผ่าน', 'Show password')
                    }
                    className="login-eye"
                    disabled={isSubmitting}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
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
                    <span>{tr('กำลังส่งข้อมูล...', 'Sending…')}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {registrationMode === 'approval'
                        ? tr('ส่งคำขอสมัครสมาชิก', 'Send sign-up request')
                        : tr('สมัครสมาชิก', 'Sign up')}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="login-switch inline-block">
                  {tr('มีบัญชีอยู่แล้ว? เข้าสู่ระบบ', 'Already have an account? Sign in')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>

      {signUpDone && (
        <AuthTransitionOverlay
          tone="success"
          title={tr('สมัครสมาชิกสำเร็จ', 'Account created')}
          subtitle={tr('กำลังพาคุณไปหน้าเข้าสู่ระบบ…', 'Taking you to the sign-in page…')}
        />
      )}
    </main>
  );
}
