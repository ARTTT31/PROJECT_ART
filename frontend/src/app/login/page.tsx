'use client';

import '../../styles/pages/login.css';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertCircle, Clock, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/context/BrandingContext';
import TurnstileWidget from '@/components/Auth/TurnstileWidget';
import { useToast } from '@/components/Toast/ToastProvider';

/** Thai date, short month (e.g. "วันพฤหัสบดีที่ 9 ต.ค. 2569") — fits one line. */
const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Hour + minute only (e.g. "14:23") — seconds are noise on a login screen. */
const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const formatDate = (date: Date) => dateFormatter.format(date);
const formatTime = (date: Date) => timeFormatter.format(date);

/**
 * Only same-origin, absolute paths are accepted as a post-login destination.
 * `//evil.example` and `https://evil.example` are protocol-relative/absolute
 * URLs, so they are refused to keep this out of open-redirect territory.
 */
function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const LOGIN_ENDPOINT = `${apiBaseUrl}/api/v1/auth/login`;
const REGISTER_ENDPOINT = `${apiBaseUrl}/api/v1/auth/register`;
const REGISTRATION_MODE_ENDPOINT = `${apiBaseUrl}/api/v1/auth/registration-mode`;

/**
 * How this deployment treats sign-ups, reported by the API:
 * `closed` (default) offers no form at all, `approval` promises an admin's
 * review, `open` signs the new account in straight away.
 */
type RegistrationMode = 'closed' | 'approval' | 'open'
type LoginView = 'signin' | 'signup' | 'pending'

/** Brand block shared by every view of this page. */
function LoginHeader({ now, tagline }: { now: Date; tagline: string }) {
  const { companyName, companyTagline, brandLogoUrl } = useBranding();
  const effectiveLogo = brandLogoUrl || '/art-workspace-mark.svg';

  return (
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
      <p className="login-tagline">{tagline || companyTagline}</p>
      <p className="login-clock">
        <Clock size={15} strokeWidth={2} aria-hidden="true" className="login-clock-icon" />
        <time suppressHydrationWarning className="login-clock-time" dateTime={now.toISOString()}>{formatTime(now)} น.</time>
        <span aria-hidden="true" className="login-clock-sep">•</span>
        <span className="login-clock-date">{formatDate(now)}</span>
      </p>
    </header>
  );
}

/**
 * Shared page chrome for the sign-up and waiting screens, so they keep the
 * exact look of the sign-in view without duplicating the shell markup.
 */
function LoginFrame({ now, tagline, children }: { now: Date; tagline: string; children: React.ReactNode }) {
  return (
    <main className="login-page">
      <section aria-label={tagline} className="login-shell">
        <div className="login-panel">
          <LoginHeader now={now} tagline={tagline} />
          {children}
        </div>
      </section>
    </main>
  );
}

function LoginContent() {
  const { login, status } = useAuth();
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
  // Where to go after a successful sign-in. AuthGuard puts the page the
  // visitor was refused at in `?next=`, which is how the admin approval alert
  // email opens the pending queue after login instead of dropping to dashboard.
  // Read it during the first render so an already-authenticated visitor is
  // redirected to the deep link instead of racing to /dashboard.
  const [nextPath] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return safeInternalPath(new URLSearchParams(window.location.search).get('next'));
  });

  // ── Sign-up state (defaults to approval for multi-user deployments) ──
  // `null` until the API answers: never promise an approval flow before the
  // deployment has confirmed that it actually accepts sign-ups.
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode | null>(null);
  const [view, setView] = useState<LoginView>('signin');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const signupNameRef = useRef<HTMLInputElement>(null);

  // Already signed in? The login page has nothing to offer — go to the
  // requested page, or the dashboard. (Logout clears auth state before
  // replacing to /login, so this never loops.)
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(nextPath || '/dashboard');
    }
  }, [status, router, nextPath]);

  /**
   * Authorization-code flow: hand off to the backend, which builds the Google
   * consent URL, exchanges the code server-side and then redirects back to
   * /login-success with the session cookies already set. No OAuth tokens ever
   * touch the browser URL or client-side code.
   */
  const handleGoogleSignIn = () => {
    setIsSubmitting(true);
    setError('');
    // The OAuth round trip leaves this SPA, so the destination is parked in
    // sessionStorage and picked up by /login-success after the callback.
    if (nextPath) {
      sessionStorage.setItem('post_login_redirect', nextPath);
    } else {
      sessionStorage.removeItem('post_login_redirect');
    }
    toast.info('กำลังนำคุณไปยัง Google...');
    // Full-page navigation is required so the browser follows the backend's
    // 302 redirect to Google; a router push would stay inside Next.js.
    const googleAuthUrl = new URL(`${apiBaseUrl}/api/v1/auth/google`, window.location.origin);
    window.location.href = googleAuthUrl.toString();
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

    // Surface refusals handed back by the backend's OAuth callback and by the
    // provider itself. The callback sends the readable reason as `google_error`
    // (sign-ups closed, account awaiting approval, ...) so the person sees why
    // they were turned away instead of a raw JSON page on the API origin.
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const googleError =
      params.get('google_error') || params.get('error') || hashParams.get('error');
    if (googleError) {
      const reason =
        googleError === 'access_denied'
          ? 'คุณยกเลิกการเข้าสู่ระบบด้วย Google'
          : googleError;
      toast.error('เข้าสู่ระบบด้วย Google ไม่สำเร็จ', reason);
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Tick every second but only store a new Date when the displayed minute
    // actually changes, so the clock stays accurate without re-rendering the
    // form 60 times a minute.
    const timer = window.setInterval(() => {
      setNow((previous) => {
        const next = new Date();
        return formatTime(next) === formatTime(previous) ? previous : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [toast]);

  // ── Ask the API how this deployment handles sign-ups ──
  // A `closed` deployment shows no sign-up affordance at all; the backend
  // refuses the endpoint there too, so this is presentation, not protection.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(REGISTRATION_MODE_ENDPOINT, {
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const mode = body?.data?.registration_mode;
        if (!cancelled && (mode === 'closed' || mode === 'approval' || mode === 'open')) {
          setRegistrationMode(mode);
        }
      })
      .catch(() => {
        // Unreachable API: keep the page as a pure sign-in form.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (view === 'signup') {
      setTimeout(() => signupNameRef.current?.focus(), 60);
    }
  }, [view]);

  /**
   * Request an account.
   *
   * In `approval` mode the API answers 201 with `status: "pending"` for a brand
   * new address AND for one that already exists — deliberately, so the form
   * cannot be used to test whether somebody is registered. The screen therefore
   * says the same thing in both cases.
   */
  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignupError('');

    const name = signupName.trim();
    const email = signupEmail.trim();

    if (!name) {
      setSignupError('กรุณากรอกชื่อที่แสดง');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignupError('กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง');
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (!acceptedTerms) {
      setSignupError('กรุณายอมรับข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก');
      return;
    }

    setIsSigningUp(true);
    try {
      const response = await fetch(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          password: signupPassword,
          // Consent (PDPA) and the optional CAPTCHA token travel with the
          // request; the backend records both.
          accepted_terms: true,
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSignupError(
          result.detail || result.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        );
        return;
      }

      if (registrationMode === 'approval') {
        setPendingEmail(email);
        setView('pending');
        return;
      }

      // open mode: the account works immediately — send them to the sign-in form.
      setEmail(email);
      setSignupPassword('');
      setSignupName('');
      setView('signin');
      toast.success('สมัครสมาชิกสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยบัญชีที่สร้างใหม่');
    } catch (err) {
      console.error('Signup submit error:', err);
      setSignupError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSigningUp(false);
    }
  };

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    rateLimitTimer.current = setInterval(() => {
      setRateLimitSeconds(s => {
        if (s <= 1) {
          clearInterval(rateLimitTimer.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(rateLimitTimer.current!);
  }, [rateLimitSeconds]);

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
        // login() persists the user + session_id and flips status to
        // 'authenticated', which triggers the redirect effect above.
        login(result.data.user, result.data.session_id);

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        toast.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับกลับมา ${result.data.user.name || ''}!`);
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

  // ── Waiting for an admin's decision (approval mode) ──
  if (view === 'pending') {
    return (
      <LoginFrame now={now} tagline="สถานะการสมัครสมาชิก">
        <div className="login-form">
          <div className="login-notice" role="status" aria-live="polite">
            <span className="login-notice-title">รอผู้ดูแลระบบอนุมัติ</span>
            เราได้รับคำขอสมัครของ <strong>{pendingEmail}</strong> แล้ว
            บัญชีจะใช้งานได้ทันทีที่ผู้ดูแลระบบอนุมัติ และเราจะแจ้งผลให้ทราบทางอีเมล
            เมื่อได้รับอนุมัติแล้วกรุณากลับมาเข้าสู่ระบบ
          </div>
          <button
            type="button"
            className="login-submit"
            onClick={() => setView('signin')}
          >
            <span>กลับไปหน้าเข้าสู่ระบบ</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </LoginFrame>
    );
  }

  // ── Sign-up (only reachable when the API reports approval/open) ──
  if (view === 'signup') {
    return (
      <LoginFrame now={now} tagline="สมัครสมาชิกเพื่อใช้งานแดชบอร์ด">
        <form onSubmit={handleSignup} className="login-form" aria-busy={isSigningUp}>
          <label htmlFor="signup-name" className="login-field">
            <span>ชื่อที่แสดง</span>
            <div className="login-input-wrap">
              <User size={18} aria-hidden="true" />
              <input
                id="signup-name"
                ref={signupNameRef}
                type="text"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                placeholder="ชื่อ-นามสกุล"
                required
                autoComplete="name"
                disabled={isSigningUp}
              />
            </div>
          </label>

          <label htmlFor="signup-email" className="login-field">
            <span>อีเมล</span>
            <div className="login-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                disabled={isSigningUp}
              />
            </div>
          </label>

          <label htmlFor="signup-password" className="login-field">
            <span>รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</span>
            <div className="login-input-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                id="signup-password"
                type="password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isSigningUp}
              />
            </div>
          </label>

          {registrationMode === 'approval' && (
            <p className="login-hint">บัญชีที่สมัครจะใช้งานได้หลังผู้ดูแลระบบอนุมัติ</p>
          )}

          <label htmlFor="signup-consent" className="login-consent">
            <input
              id="signup-consent"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              disabled={isSigningUp}
            />
            <span>
              ฉันยอมรับ{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                ข้อตกลงการใช้งาน
              </Link>{' '}
              และ{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </label>

          <TurnstileWidget onToken={setTurnstileToken} />

          {signupError && (
            <div role="alert" aria-live="polite" className="login-error">
              <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
              {signupError}
            </div>
          )}

          <button type="submit" disabled={isSigningUp} className="login-submit">
            {isSigningUp ? (
              <>
                <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                <span>กำลังส่งคำขอ...</span>
              </>
            ) : (
              <>
                <span>ส่งคำขอสมัคร</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>

          <button
            type="button"
            className="login-switch"
            onClick={() => {
              setSignupError('');
              setView('signin');
            }}
            disabled={isSigningUp}
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </form>
      </LoginFrame>
    );
  }

  return (
    <main className="login-page">
      <section aria-label="เข้าสู่ระบบ ART Workspace" className="login-shell">
        <div className="login-panel">
          <LoginHeader now={now} tagline="เข้าสู่ระบบเพื่อใช้งานแดชบอร์ดของคุณ" />

          <form onSubmit={handleSubmit} className="login-form" aria-busy={isSubmitting}>
            <label htmlFor="login-email" className="login-field">
              <span>อีเมล หรือ ชื่อผู้ใช้</span>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  name="username"
                  ref={emailRef}
                  type="text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="อีเมล หรือ ชื่อผู้ใช้"
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
                  name="password"
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

            <div className="login-row">
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
                  <span className="login-remember-knob" />
                </span>
                <span className="login-remember-text">จดจำฉันไว้</span>
              </label>
              <Link href="/forgot-password" className="login-forgot">
                ลืมรหัสผ่าน?
              </Link>
            </div>

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

            <div className="google-auth-wrapper">
              <button
                type="button"
                onClick={() => handleGoogleSignIn()}
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
            </div>

            {/* Dedicated prominent registration box */}
            <div className="pt-4 mt-3 border-t border-black/[0.08] text-center">
              <p className="text-[13.5px] text-[#6e6e73] mb-2.5">
                ยังไม่มีบัญชีสำหรับใช้งาน?
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl border border-[#0066cc]/30 bg-[#0066cc]/5 text-[#0066cc] font-bold text-[13.5px] hover:bg-[#0066cc]/10 hover:border-[#0066cc]/50 transition-all active:scale-[0.98]"
              >
                <span>สมัครสมาชิก</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              {registrationMode === 'approval' && (
                <span className="text-[11.5px] text-amber-800/80 block mt-1.5">
                  * เมื่อส่งคำขอแล้ว แอดมินจะต้องอนุมัติก่อนจึงจะเข้าสู่ระบบได้
                </span>
              )}
              {registrationMode === 'closed' && (
                <span className="text-[11.5px] text-[#86868b] block mt-1.5">
                  ระบบปิดรับสมัครสมาชิกใหม่ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน
                </span>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <LoginContent />;
}
