'use client';

import '../../styles/pages/login.css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast/ToastProvider';

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://art-workspace-api.onrender.com';
const LOGIN_ENDPOINT = `${apiBaseUrl}/api/v1/auth/login`;

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const rateLimitTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorId = 'login-error-message';

  useEffect(() => {
    setIsClient(true);
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
      setTimeout(() => passwordRef.current?.focus(), 100);
    } else {
      setTimeout(() => emailRef.current?.focus(), 100);
    }
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    rateLimitTimer.current = setInterval(() => {
      setRateLimitSeconds(s => {
        if (s <= 1) {
          clearInterval(rateLimitTimer.current!)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(rateLimitTimer.current!)
  }, [rateLimitSeconds])

  const handleCapsLock = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.getModifierState) {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password.length < 6) {
      setErrorKey(k => k + 1);
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsSubmitting(true);

    try {
      let sessionId = localStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      }

      const userAgent = navigator.userAgent;
      const deviceLabel = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'Mobile' : 'Desktop';
      const payload = { email, password, session_id: sessionId, user_agent: userAgent, device_label: deviceLabel };

      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
        setRateLimitSeconds(retryAfter);
        setErrorKey(k => k + 1);
        setError(`ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${retryAfter} วินาที`);
        setIsSubmitting(false);
        return;
      }

      const result = await response.json();

      if (response.ok && result.result === 'success' && result.data?.access_token) {
        localStorage.setItem('access_token', result.data.access_token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        if (result.data.refresh_token) localStorage.setItem('refresh_token', result.data.refresh_token);
        if (result.data.session_id) localStorage.setItem('session_id', result.data.session_id);

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        login(result.data.access_token, result.data.user);
        toast.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับกลับมา ${result.data.user.name || ''}!`);
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setError(result.detail || result.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน');
        setErrorKey(k => k + 1);
        setIsSubmitting(false);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
      setErrorKey(k => k + 1);
      setIsSubmitting(false);
    }
  };

  if (!isClient) return null;

  return (
    <main className="login-page">
      <section aria-label="เข้าสู่ระบบ ART Workspace" className="login-shell">
        <div className="login-visual">
          <div aria-hidden="true" className="login-visual-sheen" />
          <div className="login-visual-content">
            <p className="login-kicker">ART Workspace</p>

            <div>
              <h1 className="login-title">พื้นที่ทำงานของคุณ พร้อมใช้งานแล้ว</h1>
              <p className="login-subtitle">
                จัดการงาน ติดตามข้อมูลสำคัญ และเข้าถึงเครื่องมือที่ใช้ประจำในที่เดียว
              </p>
            </div>

            <div className="login-datetime" aria-label={`${formatTime(now)} ${formatDate(now)}`}>
              <div className="login-time">{formatTime(now)}</div>
              <div className="login-date">{formatDate(now)}</div>
            </div>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-form-header">
            <h2>เข้าสู่ระบบ</h2>
            <p>ยินดีต้อนรับกลับมา เข้าสู่ระบบเพื่อใช้งานแดชบอร์ดของคุณ</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" aria-busy={isSubmitting}>
            <label htmlFor="login-email" className="login-field">
              <span>อีเมล</span>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your.email@example.com"
                  required
                  autoComplete="username"
                  disabled={isSubmitting}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
            </label>

            <label htmlFor="login-password" className="login-field">
              <span>รหัสผ่าน</span>
              <div className="login-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={handleCapsLock}
                  onKeyUp={handleCapsLock}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-describedby={error ? errorId : undefined}
                />
                {capsLock && <span className="login-caps">Caps Lock</span>}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="login-eye"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </label>

            <label
              htmlFor="login-remember"
              className={`login-remember ${rememberMe ? 'login-remember--checked' : ''}`}
            >
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isSubmitting}
              />
              <span aria-hidden="true" className="login-remember-switch">
                <span className="login-remember-knob">
                  {rememberMe && <Check size={13} aria-hidden="true" />}
                </span>
              </span>
              <span className="login-remember-text">จดจำฉันไว้</span>
            </label>

            {error && (
              <div key={errorKey} id={errorId} role="alert" aria-live="polite" className="login-error">
                <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting || rateLimitSeconds > 0} className="login-submit">
              {rateLimitSeconds > 0 ? (
                <>
                  <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                  <span>รอ {rateLimitSeconds} วินาที...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>

            <div className="login-divider">หรือ</div>

            <a
              href={`${apiBaseUrl}/api/v1/auth/google`}
              className={`google-btn${isSubmitting || rateLimitSeconds > 0 ? ' google-btn--disabled' : ''}`}
              role="button"
              aria-label="Sign in with Google"
              aria-disabled={isSubmitting || rateLimitSeconds > 0}
              tabIndex={isSubmitting || rateLimitSeconds > 0 ? -1 : 0}
              onClick={e => { if (isSubmitting || rateLimitSeconds > 0) e.preventDefault() }}
            >
              <svg className="google-btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M12 7.2c1.8 0 3.2.7 4.2 1.6l3-3C17.7 4 15 3 12 3 7 3 3 6.2 1.9 10.6l3.5 2.7C6 8.9 8.7 7.2 12 7.2z"/>
                <path fill="#34A853" d="M21.6 12.6c0-.8-.1-1.4-.2-2.1H12v4.1h5.6c-.5 1.9-2 4.5-5.6 5.9l-1.6-1.2c2.6-1 4-2.9 4.6-4.8H21.6z"/>
                <path fill="#FBBC05" d="M6.4 16.8c-.4-1.1-.6-2.2-.6-3.4s.2-2.3.6-3.4L3 7.1C2 9.3 1.5 11.8 1.5 14.4s.5 5.1 1.5 7.3l3-3z"/>
                <path fill="#EA4335" d="M12 20.5c2.8 0 5.2-.9 6.9-2.4l-3.3-2.5c-1 .7-2.4 1.2-3.6 1.2-2.1 0-3.9-1.4-4.6-3.4l-3 2.3C6.1 18.8 8.8 20.5 12 20.5z"/>
              </svg>
              <span className="google-text">Sign in with Google</span>
            </a>
          </form>


        </div>
      </section>

    </main>
  );
}
