'use client';

import '../../styles/pages/login.css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast/ToastProvider';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';

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
    // Initialize Google Sign-In with explicit clientId and redirectUrl for Web
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId) {
      console.log("Initializing GoogleSignIn with clientId:", clientId);
      GoogleSignIn.initialize({ 
        clientId,
        redirectUrl: window.location.origin + '/login'
      }).then(() => {
        console.log("GoogleSignIn initialized. Checking for redirect callback...");
        return GoogleSignIn.handleRedirectCallback();
      }).then((result) => {
        console.log("handleRedirectCallback result:", result);
        if (result && result.idToken) {
          toast.info("ได้รับข้อมูลจาก Google กำลังยืนยันตัวตน...");
          setIsSubmitting(true);
          verifyGoogleToken(result.idToken);
        } else if (result && result.serverAuthCode) {
           // In case forceCodeForRefreshToken causes only serverAuthCode to be returned
           toast.info("ได้รับ Auth Code จาก Google กำลังยืนยันตัวตน...");
           setIsSubmitting(true);
           verifyGoogleToken(result.serverAuthCode);
        }
      }).catch((e) => {
        const isNoTokenError = e?.message?.includes('No ID token found') || e?.message?.includes('No result');
        if (isNoTokenError) {
          console.log("GoogleSignIn: No redirect callback state found in URL (normal page load).");
        } else {
          console.error("handleRedirectCallback error:", e);
        }
      });
    }

    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const verifyGoogleToken = async (idToken: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/google/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await response.json();

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
    } catch (error) {
      console.error('Verify token error:', error);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
      setErrorKey(k => k + 1);
      setIsSubmitting(false);
    }
  };

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

  const handleGoogleSignIn = async () => {
    if (isSubmitting || rateLimitSeconds > 0) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Sign in with Google using Capacitor plugin
      const result = await GoogleSignIn.signIn();

      if (result && result.idToken) {
        // Send the ID token to backend for verification (for Android/iOS that resolve immediately)
        await verifyGoogleToken(result.idToken);
      } else {
        setError('ไม่สามารถรับข้อมูลจาก Google ได้');
        setErrorKey(k => k + 1);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      if (error.message && error.message.includes('User canceled')) {
        setError('ยกเลิกการเข้าสู่ระบบด้วย Google');
      } else {
        setError(`เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google: ${error.message || 'Unknown error'}`);
      }
      setErrorKey(k => k + 1);
      setIsSubmitting(false);
    }
  };

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
        credentials: 'include',
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

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || rateLimitSeconds > 0}
              className={`google-btn${isSubmitting || rateLimitSeconds > 0 ? ' google-btn--disabled' : ''}`}
              aria-label="ดำเนินการต่อด้วย Google"
            >
              <span className="google-btn-mark" aria-hidden="true">
                <svg className="google-btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" focusable="false">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </span>
              <span className="google-text">ดำเนินการต่อด้วย Google</span>
            </button>
          </form>


        </div>
      </section>

    </main>
  );
}
