'use client';

import '../../styles/pages/login.css';
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
  ShieldCheck,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api/apiBase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/context/BrandingContext';
import TurnstileWidget from '@/components/Auth/TurnstileWidget';
import ApprovalPending from '@/components/Auth/ApprovalPending';
import AuthTransitionOverlay from '@/components/Auth/AuthTransitionOverlay';
import { useToast } from '@/components/Toast/ToastProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { parseUserAgent } from '@/utils/userAgent';

/** Thai date, short month (e.g. "วันพฤหัสบดีที่ 9 ต.ค. 2569") — fits one line. */
const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Hour, minute and second (e.g. "14:23:45"). */
const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
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

const apiBaseUrl = getApiBaseUrl();
const LOGIN_ENDPOINT = `${apiBaseUrl}/api/v1/auth/login`;
const REGISTER_ENDPOINT = `${apiBaseUrl}/api/v1/auth/register`;
const REGISTRATION_MODE_ENDPOINT = `${apiBaseUrl}/api/v1/auth/registration-mode`;

/**
 * How this deployment treats sign-ups, reported by the API:
 * `closed` (default) offers no form at all, `approval` promises an admin's
 * review, `open` signs the new account in straight away.
 */
type RegistrationMode = 'closed' | 'approval' | 'open';
type LoginView = 'signin' | 'signup' | 'pending';

/** Brand block shared by every view of this page. */
function LoginHeader({ now, tagline }: { now: Date; tagline: string }) {
  const { companyName, companyTagline, brandLogoUrl } = useBranding();
  const { tr } = useI18n();
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
        <time suppressHydrationWarning className="login-clock-time" dateTime={now.toISOString()}>
          {tr('{time} น.', '{time}', { time: formatTime(now) })}
        </time>
        <span aria-hidden="true" className="login-clock-sep">
          •
        </span>
        <span className="login-clock-date">{formatDate(now)}</span>
      </p>
    </header>
  );
}

/**
 * Shared page chrome for the sign-up and waiting screens, so they keep the
 * exact look of the sign-in view without duplicating the shell markup.
 */
function LoginFrame({
  now,
  tagline,
  children,
}: {
  now: Date;
  tagline: string;
  children: React.ReactNode;
}) {
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
  const { tr } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  // Second factor: the API answers `totp_required` once the password checks
  // out, and the same credentials are resent with the code alongside them.
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const totpRef = useRef<HTMLInputElement>(null);
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
  const [signInDone, setSignInDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const signupNameRef = useRef<HTMLInputElement>(null);

  // Already signed in? The login page has nothing to offer — go to the
  // requested page, or the dashboard. (Logout clears auth state before
  // replacing to /login, so this never loops.)
  useEffect(() => {
    if (status !== 'authenticated') return;
    // A fresh sign-in keeps a short success beat on screen before the
    // dashboard loads; a restored session (already authenticated on mount)
    // must redirect straight away.
    if (!signInDone) {
      router.replace(nextPath || '/dashboard');
      return;
    }
    const timer = window.setTimeout(() => router.replace(nextPath || '/dashboard'), 750);
    return () => window.clearTimeout(timer);
  }, [status, router, nextPath, signInDone]);

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

    // Tick every second; the form re-renders only when the displayed second
    // changes, so the clock stays accurate without needless renders.
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
      setSignupError(tr('กรุณากรอกชื่อที่แสดง', 'Please enter a display name'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignupError(tr('กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง', 'Please check the email format and try again'));
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError(tr('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'Password must be at least 8 characters'));
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
          // The optional CAPTCHA token travels with the request; the backend
          // verifies it when the deployment has Turnstile configured.
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSignupError(
          result.detail ||
            result.message ||
            tr('สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'Sign-up failed. Please try again'),
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
      toast.success(
        tr('สมัครสมาชิกสำเร็จ', 'Account created'),
        tr('กรุณาเข้าสู่ระบบด้วยบัญชีที่สร้างใหม่', 'Please sign in with your new account'),
      );
    } catch (err) {
      console.error('Signup submit error:', err);
      setSignupError(tr('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง', 'Connection error. Please try again'));
    } finally {
      setIsSigningUp(false);
    }
  };

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    rateLimitTimer.current = setInterval(() => {
      setRateLimitSeconds((s) => {
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
      setErrorKey((k) => k + 1);
      setError(tr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'Password must be at least 6 characters'));
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
      // A specific label (browser + OS) is what the admin device panel shows;
      // "Mobile"/"Desktop" alone cannot tell two phones apart.
      const parsedUa = parseUserAgent(userAgent);
      const deviceLabel =
        [parsedUa.browser, parsedUa.os]
          .filter((part) => part && part !== 'ไม่ระบุ')
          .join(' · ') || (parsedUa.isMobile ? 'Mobile' : 'Desktop');
      const secondFactor = totpCode.trim();
      const payload = {
        email,
        password,
        session_id: sessionId,
        user_agent: userAgent,
        device_label: deviceLabel,
        // A 6-digit value is an authenticator code; anything else is treated
        // as a recovery code, so a lost phone is not a dead end.
        ...(secondFactor
          ? /^\d{6}$/.test(secondFactor)
            ? { totp_code: secondFactor }
            : { recovery_code: secondFactor }
          : {}),
      };

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
        setErrorKey((k) => k + 1);
        setError(
          tr(
            'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ {seconds} วินาที',
            'Too many sign-in attempts. Please wait {seconds} seconds',
            { seconds: retryAfter },
          ),
        );
        setIsSubmitting(false);
        return;
      }

      const result = await response.json().catch(() => ({}));

      if (result.result === 'totp_required') {
        setTotpRequired(true);
        setError('');
        setIsSubmitting(false);
        setTotpCode('');
        // The code field only exists after this render.
        setTimeout(() => totpRef.current?.focus(), 0);
        return;
      }

      if (response.ok && result.result === 'success') {
        // login() persists the user + session_id and flips status to
        // 'authenticated', which triggers the redirect effect above.
        setSignInDone(true);
        login(result.data.user, result.data.session_id);

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        toast.success(
          tr('เข้าสู่ระบบสำเร็จ', 'Signed in'),
          tr('ยินดีต้อนรับกลับมา {name}!', 'Welcome back, {name}!', {
            name: result.data.user.name || '',
          }),
        );
      } else {
        setError(
          result.detail ||
            result.message ||
            tr(
              'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน',
              'Sign-in failed. Please check your email and password',
            ),
        );
        setErrorKey((k) => k + 1);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Login submit error:', err);
      if (err.name === 'AbortError') {
        setError(
          tr(
            'การเชื่อมต่อเซิร์ฟเวอร์ใช้เวลานานเกินไป กรุณากดลองใหม่อีกครั้ง',
            'The server took too long to respond. Please try again',
          ),
        );
      } else {
        setError(tr('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง', 'Connection error. Please try again'));
      }
      setErrorKey((k) => k + 1);
      setIsSubmitting(false);
    }
  };

  if (!isClient) return null;

  // ── Waiting for an admin's decision (approval mode) ──
  if (view === 'pending') {
    return (
      <LoginFrame
        now={now}
        tagline={tr('สถานะการสมัครสมาชิก', 'Sign-up status')}
      >
        <ApprovalPending
          email={pendingEmail}
          title={tr('ได้รับคำขอสมัครสมาชิกแล้ว', 'Sign-up request received')}
          lead={
            <>
              {tr('เราได้รับคำขอของ', 'We received a request from')}{' '}
              <strong>{pendingEmail}</strong>
              {tr(' แล้ว', '.')}
            </>
          }
          note={tr(
            'บัญชีจะใช้งานได้ทันทีที่ผู้ดูแลระบบอนุมัติ และเราจะแจ้งผลให้ทราบทางอีเมล',
            "Your account works as soon as an admin approves it, and we'll email you the result",
          )}
          onBack={() => setView('signin')}
        />
      </LoginFrame>
    );
  }

  // ── Sign-up (only reachable when the API reports approval/open) ──
  if (view === 'signup') {
    return (
      <LoginFrame now={now} tagline={tr('สมัครสมาชิกเพื่อใช้งานแดชบอร์ด', 'Sign up to use the dashboard')}>
        <form
          onSubmit={handleSignup}
          className="login-form login-view-enter"
          aria-busy={isSigningUp}
        >
          <label htmlFor="signup-name" className="login-field">
            <span>{tr('ชื่อที่แสดง', 'Display name')}</span>
            <div className="login-input-wrap">
              <User size={18} aria-hidden="true" />
              <input
                id="signup-name"
                ref={signupNameRef}
                type="text"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                placeholder={tr('ชื่อ-นามสกุล', 'Full name')}
                required
                autoComplete="name"
                disabled={isSigningUp}
              />
            </div>
          </label>

          <label htmlFor="signup-email" className="login-field">
            <span>{tr('อีเมล', 'Email')}</span>
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
            <span>{tr('รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)', 'Password (at least 8 characters)')}</span>
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
            <p className="login-hint">
              {tr(
                'บัญชีที่สมัครจะใช้งานได้หลังผู้ดูแลระบบอนุมัติ',
                'New accounts work after an admin approves them',
              )}
            </p>
          )}

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
                <span>{tr('กำลังส่งคำขอ...', 'Sending request…')}</span>
              </>
            ) : (
              <>
                <span>{tr('ส่งคำขอสมัคร', 'Send sign-up request')}</span>
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
            {tr('กลับไปหน้าเข้าสู่ระบบ', 'Back to sign in')}
          </button>
        </form>
      </LoginFrame>
    );
  }

  return (
    <main className="login-page">
      <section aria-label={tr('เข้าสู่ระบบ ART Workspace', 'Sign in to ART Workspace')} className="login-shell">
        <div className="login-panel">
          <LoginHeader now={now} tagline={tr('เข้าสู่ระบบเพื่อใช้งานแดชบอร์ดของคุณ', 'Sign in to your dashboard')} />

          <form
            onSubmit={handleSubmit}
            className="login-form login-view-enter"
            aria-busy={isSubmitting}
          >
            <label htmlFor="login-email" className="login-field">
              <span>{tr('อีเมล หรือ ชื่อผู้ใช้', 'Email or username')}</span>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  name="username"
                  ref={emailRef}
                  type="text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={tr('อีเมล หรือ ชื่อผู้ใช้', 'Email or username')}
                  required
                  autoComplete="username"
                  disabled={isSubmitting}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
            </label>

            <label htmlFor="login-password" className="login-field">
              <span>{tr('รหัสผ่าน', 'Password')}</span>
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
                  aria-label={
                    showPassword
                      ? tr('ซ่อนรหัสผ่าน', 'Hide password')
                      : tr('แสดงรหัสผ่าน', 'Show password')
                  }
                  className="login-eye"
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
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
                <span className="login-remember-text">{tr('จดจำฉันไว้', 'Remember me')}</span>
              </label>
            </div>

            <div className="login-hint" style={{ textAlign: 'right', marginTop: -4 }}>
              <Link
                href="/forgot-password"
                className="font-semibold text-[var(--accent)] hover:underline"
              >
                {tr('ลืมรหัสผ่าน?', 'Forgot password?')}
              </Link>
            </div>

            {totpRequired && (
              <label htmlFor="login-totp" className="login-field">
                <span>{tr('รหัสยืนยัน 6 หลัก', '6-digit verification code')}</span>
                <div className="login-input-wrap">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <input
                    id="login-totp"
                    ref={totpRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={11}
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value)}
                    placeholder="123456"
                    aria-describedby="login-totp-hint"
                    disabled={isSubmitting}
                  />
                </div>
              </label>
            )}

            {totpRequired && (
              <p id="login-totp-hint" className="login-hint">
                {tr(
                  'เปิดรหัสจากแอป Authenticator หรือกรอกรหัสสำรอง (แบบ xxxxx-xxxxx) ในช่องนี้',
                  'Open the code in your authenticator app, or enter a recovery code (xxxxx-xxxxx) here',
                )}
              </p>
            )}

            {error && (
              <div
                key={errorKey}
                id={errorId}
                role="alert"
                aria-live="polite"
                className="login-error"
              >
                <AlertCircle size={16} aria-hidden="true" className="login-error-icon" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || rateLimitSeconds > 0}
              className="login-submit"
            >
              {rateLimitSeconds > 0 ? (
                <>
                  <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                  <span>
                    {tr('รอ {seconds} วินาที...', 'Wait {seconds} seconds…', {
                      seconds: rateLimitSeconds,
                    })}
                  </span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                  <span>{tr('กำลังเข้าสู่ระบบ...', 'Signing in…')}</span>
                </>
              ) : (
                <>
                  <span>{tr('เข้าสู่ระบบ', 'Sign in')}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>

            {/* Dedicated prominent registration box */}
            <div className="pt-4 mt-3 border-t border-[var(--hairline)] text-center">
              <p className="text-[13px] text-[var(--ink-muted)] mb-2.5">
                {tr('ยังไม่มีบัญชีสำหรับใช้งาน?', "Don't have an account yet?")}
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-apple-widget border border-[var(--accent-border)] bg-[var(--accent-soft-weak)] text-[var(--accent-text)] font-bold text-[13px] hover:bg-[var(--accent-soft)] hover:border-[var(--accent-border)] transition-all active:scale-[0.98]"
              >
                <span>{tr('สมัครสมาชิก', 'Sign up')}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>

              {registrationMode === 'closed' && (
                <span className="text-[12px] text-[var(--ink-tertiary)] block mt-1.5">
                  {tr(
                    'ระบบปิดรับสมัครสมาชิกใหม่ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน',
                    'Sign-ups are closed. Contact your administrator to request access',
                  )}
                </span>
              )}
            </div>
          </form>
        </div>
      </section>

      {signInDone && (
        <AuthTransitionOverlay
          tone="success"
          title={tr('เข้าสู่ระบบสำเร็จ', 'Signed in')}
          subtitle={tr('กำลังพาคุณเข้าสู่แดชบอร์ด…', 'Taking you to your dashboard…')}
        />
      )}
    </main>
  );
}

export default function LoginPage() {
  return <LoginContent />;
}
