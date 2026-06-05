'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
const loginEndpoints = [
  `${apiBaseUrl.replace(/\/$/, '')}/api/v1/auth/login`,
  '/api/v1/auth/login',
  'http://localhost:8888/api/v1/auth/login',
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setIsClient(true);
    const rememberedEmail = localStorage.getItem('remembered_email');

    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }

    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCapsLock = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.getModifierState) {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let sessionId = localStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      }

      const userAgent = navigator.userAgent;
      const deviceLabel = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'Mobile' : 'Desktop';
      const payload = {
        email,
        password,
        session_id: sessionId,
        user_agent: userAgent,
        device_label: deviceLabel,
      };

      let response: Response | null = null;
      for (const endpoint of loginEndpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.status < 500) {
            break;
          }
        } catch {
          response = null;
        }
      }

      if (!response) {
        throw new Error('Login API is unavailable');
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
        
        // Custom iOS-style success toast
        const toast = document.createElement('div');
        toast.className = 'liquid-glass-toast';
        toast.innerHTML = `
          <div class="toast-icon-wrapper">
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div class="toast-content">
            <h4 class="toast-title">เข้าสู่ระบบสำเร็จ</h4>
            <p class="toast-message">ยินดีต้อนรับกลับมา ${result.data.user.name || ''}!</p>
          </div>
        `;
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('toast-show'), 10);
        
        // Remove and redirect
        setTimeout(() => {
          toast.classList.remove('toast-show');
          setTimeout(() => {
            document.body.removeChild(toast);
            window.location.href = '/dashboard';
          }, 300);
        }, 2500);
      } else {
        setError(result.detail || result.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน');
        setIsSubmitting(false);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
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

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-email" className="login-field">
              <span>อีเมล</span>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your.email@example.com"
                  required
                  autoComplete="username"
                />
              </div>
            </label>

            <label htmlFor="login-password" className="login-field">
              <span>รหัสผ่าน</span>
              <div className="login-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={handleCapsLock}
                  onKeyUp={handleCapsLock}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                {capsLock && <span className="login-caps">Caps Lock</span>}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="login-eye"
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
              />
              <span aria-hidden="true" className="login-remember-switch">
                <span className="login-remember-knob">
                  {rememberMe && <Check size={13} aria-hidden="true" />}
                </span>
              </span>
              <span className="login-remember-text">จดจำฉันไว้</span>
            </label>

            {error && <div role="alert" className="login-error">{error}</div>}

            <button type="submit" disabled={isSubmitting} className="login-submit">
              <span>{isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
              {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>
        </div>
      </section>

      <style jsx global>{`
        /* Liquid Glass Toast Notification */
        .liquid-glass-toast {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(-120px);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 360px;
          max-width: 480px;
          padding: 16px 20px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 16px 48px rgba(15, 23, 42, 0.15),
            0 8px 24px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
          opacity: 0;
          transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .liquid-glass-toast.toast-show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        
        .toast-icon-wrapper {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          box-shadow: 
            0 4px 16px rgba(34, 197, 94, 0.30),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          animation: icon-pop 500ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes icon-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .toast-icon {
          width: 26px;
          height: 26px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }
        
        .toast-content {
          flex: 1;
          min-width: 0;
        }
        
        .toast-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #0f172a;
          line-height: 1.3;
        }
        
        .toast-message {
          margin: 4px 0 0;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #64748b;
          line-height: 1.5;
        }
        
        @media (max-width: 860px) {
          .liquid-glass-toast {
            min-width: calc(100vw - 48px);
            max-width: calc(100vw - 48px);
            left: 24px;
            transform: translateX(0) translateY(-120px);
          }
          
          .liquid-glass-toast.toast-show {
            transform: translateX(0) translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
