'use client';

import '@/styles/pages/login.css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/context/BrandingContext';
import TurnstileWidget from '@/components/Auth/TurnstileWidget';
import { useToast } from '@/components/Toast/ToastProvider';
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
      setError('กรุณากรอกชื่อที่แสดง');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง');
      return;
    }
    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
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

          accepted_terms: true,
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.detail || result.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      setRegisteredEmail(trimmedEmail);

      if (registrationMode === 'approval') {
        setIsPendingSuccess(true);
        return;
      }

      // Open mode: account works immediately
      toast.success('สมัครสมาชิกสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยบัญชีที่สร้างใหม่');
      router.push('/login');
    } catch (err) {
      console.error('Registration submit error:', err);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveLogo = brandLogoUrl || '/art-workspace-mark.svg';

  return (
    <main className="login-page">
      <section aria-label={`สมัครสมาชิก ${companyName}`} className="login-shell">
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
              {companyTagline || 'สมัครสมาชิกเพื่อเริ่มต้นใช้งานแดชบอร์ด'}
            </p>
            <p className="login-clock">
              <Clock size={15} strokeWidth={2} aria-hidden="true" className="login-clock-icon" />
              <time
                suppressHydrationWarning
                className="login-clock-time"
                dateTime={now.toISOString()}
              >
                {formatTime(now)} น.
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
              <p className="text-[13px] text-[var(--ink-tertiary)]">กำลังตรวจสอบระบบการรับสมัคร...</p>
            </div>
          ) : isPendingSuccess ? (
            /* Success awaiting approval state */
            <div className="space-y-4">
              <div className="login-notice flex flex-col items-center text-center p-6 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-3">
                  <Clock size={24} aria-hidden="true" />
                </div>
                <span className="text-[16px] font-bold text-amber-900 mb-1">
                  ส่งคำขอสมัครสมาชิกสำเร็จแล้ว
                </span>
                <p className="text-[13.5px] text-amber-800/90 leading-relaxed max-w-sm">
                  เราได้รับคำขอสมัครของ <strong>{registeredEmail}</strong> เรียบร้อยแล้ว
                </p>
                <div className="mt-3 p-3 rounded-xl bg-[var(--glass-80)] border border-amber-200/60 text-[12.5px] text-slate-700 leading-relaxed text-left w-full">
                  <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-600" />
                    ระบบนี้กำหนดให้แอดมินอนุมัติก่อนเข้าใช้งาน
                  </div>
                  เมื่อผู้ดูแลระบบกดรับคำขอของคุณแล้ว บัญชีจะสามารถเข้าสู่ระบบได้ทันที
                </div>
              </div>

              <Link href="/login" className="login-submit inline-flex items-center justify-center">
                <span>กลับไปหน้าเข้าสู่ระบบ</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : registrationMode === 'closed' ? (
            /* Registration closed state */
            <div className="space-y-4 text-center py-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center mb-3">
                  <Lock size={22} />
                </div>
                <h2 className="text-[15px] font-bold text-slate-900 mb-1">
                  ปิดรับสมัครสมาชิกชั่วคราว
                </h2>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  ระบบนี้กำหนดให้เฉพาะผู้ดูแลระบบสร้างบัญชีให้เท่านั้น
                  หากต้องการใช้งานกรุณาติดต่อผู้ดูแลระบบของคุณ
                </p>
              </div>

              <Link href="/login" className="login-submit inline-flex items-center justify-center">
                <span>เข้าสู่ระบบด้วยบัญชีที่มีอยู่</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit} className="login-form" aria-busy={isSubmitting}>
              <label htmlFor="reg-name" className="login-field">
                <span>ชื่อที่แสดง</span>
                <div className="login-input-wrap">
                  <User size={18} aria-hidden="true" />
                  <input
                    id="reg-name"
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น สมชาย ใจดี หรือ ทีมงาน"
                    required
                    autoComplete="name"
                    disabled={isSubmitting}
                  />
                </div>
              </label>

              <label htmlFor="reg-email" className="login-field">
                <span>อีเมล</span>
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
                <span>รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</span>
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
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="login-eye"
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label htmlFor="reg-confirm-password" className="login-field">
                <span>ยืนยันรหัสผ่าน</span>
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
                    aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
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
                    <span>กำลังส่งข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {registrationMode === 'approval' ? 'ส่งคำขอสมัครสมาชิก' : 'สมัครสมาชิก'}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="login-switch inline-block">
                  มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
