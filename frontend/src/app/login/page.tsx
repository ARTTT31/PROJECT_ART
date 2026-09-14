'use client';

import '../../styles/pages/login.css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast/ToastProvider';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://project-art-c7eh.onrender.com';
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

  const verifyGoogleToken = useCallback(async (idToken: string) => {
    setIsSubmitting(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/google/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id_token: idToken }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.result === 'success') {
        localStorage.setItem('user', JSON.stringify(data.data.user));
        if (data.data.session_id) localStorage.setItem('session_id', data.data.session_id);
        login(data.data.user);
        toast.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับกลับมา ${data.data.user.name || ''}!`);
        setTimeout(() => router.push('/dashboard'), 300);
      } else {
        setError(data.detail || data.message || 'การยืนยันตัวตน Google ไม่สำเร็จ');
        setErrorKey(k => k + 1);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Verify token error:', err);
      if (err.name === 'AbortError') {
        setError('การเชื่อมต่อเซิร์ฟเวอร์ใช้เวลานานเกินไป กรุณากดลองใหม่อีกครั้ง');
      } else {
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
      }
      setErrorKey(k => k + 1);
      setIsSubmitting(false);
    }
  }, [login, router, toast]);

  const handleGoogleSignIn = async () => {
    toast.info('Google Sign-In สำหรับเว็บกำลังอยู่ระหว่างการพัฒนา');
  };


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

    // Web-based Google Sign In would be implemented here using @react-oauth/google
    // Since we removed Capacitor, this needs to be refactored to standard web flow.
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId) {
      // Placeholder for standard web initialize
    }

    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [toast, verifyGoogleToken]);

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
        credentials: 'include',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
        setRateLimitSeconds(retryAfter);
        setErrorKey(k => k + 1);
        setError(`ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${retryAfter} วินาที`);
        setIsSubmitting(false);
        return;
      }

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.result === 'success') {
        localStorage.setItem('user', JSON.stringify(result.data.user));
        if (result.data.session_id) localStorage.setItem('session_id', result.data.session_id);

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        login(result.data.user);
        toast.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับกลับมา ${result.data.user.name || ''}!`);
        setTimeout(() => router.push('/dashboard'), 300);
      } else {
        setError(result.detail || result.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน');
        setErrorKey(k => k + 1);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Login submit error:', err);
      if (err.name === 'AbortError') {
        setError('การเชื่อมต่อเซิร์ฟเวอร์ใช้เวลานานเกินไป กรุณากดลองใหม่อีกครั้ง');
      } else {
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
      }
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
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="login-kicker">ART Workspace</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white/95 backdrop-blur-md">
                ระบบพร้อมใช้งาน
              </span>
            </div>

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
              <span>อีเมล หรือ ชื่อผู้ใช้</span>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  ref={emailRef}
                  type="text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your.email@example.com หรือ ชื่อผู้ใช้"
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

            <div className="google-auth-wrapper" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '1rem' }}>
              {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
                <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
                  <GoogleLogin
                    onSuccess={credentialResponse => {
                      if (credentialResponse.credential) {
                        toast.info("ได้รับข้อมูลจาก Google กำลังยืนยันตัวตน...");
                        verifyGoogleToken(credentialResponse.credential);
                      }
                    }}
                    onError={() => {
                      toast.error('การเข้าสู่ระบบด้วย Google ล้มเหลว');
                    }}
                    useOneTap
                    shape="pill"
                    text="continue_with"
                    width="100%"
                  />
                </GoogleOAuthProvider>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting || rateLimitSeconds > 0}
                  className={`google-btn${isSubmitting || rateLimitSeconds > 0 ? ' google-btn--disabled' : ''}`}
                  aria-label="ดำเนินการต่อด้วย Google"
                >
                  <span className="google-text">Google Sign-In ไม่ได้ตั้งค่า Client ID</span>
                </button>
              )}
            </div>
          </form>


        </div>
      </section>

    </main>
  );
}
