'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { SectionCard, InsetField } from './SectionCard';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useToast } from '@/components/Toast/ToastProvider';

/**
 * Two-factor authentication (TOTP) for the signed-in account.
 *
 * Three states, deliberately not one toggle:
 *  - ``idle``    — off, or on and nothing being edited.
 *  - ``setup``   — a secret exists but is NOT active; the account is still
 *                  protected by the password alone until a code proves the
 *                  authenticator works.
 *  - ``codes``   — recovery codes, shown exactly once.
 * Disabling asks for the password AND a live code, so a stolen session cannot
 * strip the second factor.
 */

type Phase = 'idle' | 'setup' | 'codes' | 'disable';

interface SetupData {
  secret: string;
  otpauth_uri: string;
}

const STATUS_ENDPOINT = '/api/v1/auth/2fa/status';
const SETUP_ENDPOINT = '/api/v1/auth/2fa/setup';
const ENABLE_ENDPOINT = '/api/v1/auth/2fa/enable';
const DISABLE_ENDPOINT = '/api/v1/auth/2fa/disable';

/** Read the API's Thai error text without assuming a JSON shape. */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.detail || body?.message || fallback;
  } catch {
    return fallback;
  }
}

export function SecurityCard() {
  const toast = useToast();

  const [enabled, setEnabled] = useState(false);
  const [codesLeft, setCodesLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetchWithAuth(STATUS_ENDPOINT);
      if (!response.ok) return;
      const body = await response.json();
      setEnabled(Boolean(body?.data?.enabled));
      setCodesLeft(Number(body?.data?.recovery_codes_remaining) || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const reset = () => {
    setPhase('idle');
    setSetup(null);
    setCode('');
    setPassword('');
    setRecoveryCodes([]);
    setError('');
  };

  const startSetup = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetchWithAuth(SETUP_ENDPOINT, { method: 'POST' });
      if (!response.ok) {
        setError(await errorMessage(response, 'เริ่มตั้งค่าไม่สำเร็จ กรุณาลองใหม่'));
        return;
      }
      const body = await response.json();
      setSetup({ secret: body.data.secret, otpauth_uri: body.data.otpauth_uri });
      setPhase('setup');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (code.replace(/\D/g, '').length !== 6) {
      setError('กรอกรหัส 6 หลักจากแอป Authenticator');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetchWithAuth(ENABLE_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        setError(await errorMessage(response, 'รหัสไม่ถูกต้อง กรุณาลองใหม่'));
        return;
      }
      const body = await response.json();
      setEnabled(true);
      setCodesLeft(body.data.recovery_codes?.length ?? 0);
      setRecoveryCodes(body.data.recovery_codes ?? []);
      setPhase('codes');
      setCode('');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (!password) {
      setError('กรอกรหัสผ่านเพื่อยืนยัน');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetchWithAuth(DISABLE_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ password, code }),
      });
      if (!response.ok) {
        setError(await errorMessage(response, 'ปิดการใช้งานไม่สำเร็จ'));
        return;
      }
      setEnabled(false);
      setCodesLeft(0);
      reset();
      toast.success('ปิดการยืนยันสองขั้นตอนแล้ว', 'บัญชีของคุณจะใช้เพียงรหัสผ่าน');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      toast.success('คัดลอกแล้ว', 'เก็บรหัสสำรองไว้ในที่ปลอดภัย');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ', 'กรุณาเลือกข้อความแล้วคัดลอกเอง');
    }
  };

  return (
    <SectionCard
      icon={<ShieldCheck size={19} aria-hidden="true" />}
      iconBg="bg-indigo-50"
      iconColor="text-indigo-600"
      iconRing="ring-indigo-200/60"
      title="การยืนยันสองขั้นตอน (2FA)"
      subtitle="เพิ่มรหัส 6 หลักจากแอป Authenticator เป็นชั้นป้องกันที่สอง"
      badge={enabled ? 'เปิดใช้งาน' : undefined}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-[var(--ink-muted)]">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          กำลังตรวจสอบสถานะ…
        </div>
      ) : phase === 'setup' && setup ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-[14px] bg-[var(--surface-grouped)] p-4 sm:flex-row sm:items-start">
            <div className="rounded-[11px] bg-white p-2.5 ring-1 ring-[var(--hairline)]">
              <QRCodeSVG
                value={setup.otpauth_uri}
                size={132}
                level="M"
                aria-label="QR Code สำหรับเพิ่มบัญชีในแอป Authenticator"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                <Smartphone size={14} aria-hidden="true" />
                สแกนด้วย Google Authenticator / Microsoft Authenticator
              </p>
              <p className="text-[12px] leading-relaxed text-[var(--ink-muted)]">
                สแกนไม่ได้? กรอกรหัสนี้ในแอปแทน
              </p>
              <code className="block select-all break-all rounded-[11px] bg-[var(--surface)] px-3 py-2 font-mono text-[12px] text-[var(--ink)] ring-1 ring-[var(--hairline)]">
                {setup.secret}
              </code>
            </div>
          </div>

          <InsetField
            id="totp-enable-code"
            label="รหัส 6 หลักจากแอป"
            value={code}
            onChange={setCode}
            placeholder="123456"
            icon={<ShieldCheck size={16} aria-hidden="true" />}
            autoComplete="one-time-code"
            hint="รหัสจะเปลี่ยนทุก 30 วินาที"
          />

          {error && (
            <p className="flex items-start gap-1.5 text-[12px] font-medium text-[var(--danger)]" role="alert">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-[var(--ink-secondary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] active:scale-[0.96]"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={confirmEnable}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-[0.96]"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Check size={14} aria-hidden="true" />
              )}
              ยืนยันและเปิดใช้งาน
            </button>
          </div>
        </div>
      ) : phase === 'codes' ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-[14px] bg-[var(--warning-soft)] p-3 text-[12px] leading-relaxed text-[var(--ink)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              เก็บรหัสสำรองเหล่านี้ไว้ให้ปลอดภัย — แต่ละรหัสใช้ได้ครั้งเดียว
              และจะแสดงเพียงครั้งนี้เท่านั้น ใช้แทนรหัสจากแอปเมื่อเครื่องหาย
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-2 font-mono text-[13px] text-[var(--ink)] sm:grid-cols-2">
            {recoveryCodes.map((recovery) => (
              <li
                key={recovery}
                className="select-all rounded-[11px] bg-[var(--surface-grouped)] px-3 py-2 text-center ring-1 ring-[var(--hairline)]"
              >
                {recovery}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={copyRecoveryCodes}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--hairline-strong)] px-5 py-2.5 text-[13px] font-bold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] active:scale-[0.96]"
            >
              <Copy size={14} aria-hidden="true" />
              คัดลอกรหัสสำรอง
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.96]"
            >
              บันทึกไว้แล้ว
            </button>
          </div>
        </div>
      ) : enabled ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--surface-grouped)] p-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                เปิดใช้งานอยู่ — ต้องกรอกรหัสจากแอปทุกครั้งที่เข้าสู่ระบบ
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                รหัสสำรองคงเหลือ {codesLeft} รหัส
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--success)]">
              ปลอดภัย
            </span>
          </div>

          {phase === 'disable' ? (
            <div className="space-y-4">
              <InsetField
                id="totp-disable-password"
                label="รหัสผ่านปัจจุบัน"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="กรอกรหัสผ่าน"
                icon={<ShieldCheck size={16} aria-hidden="true" />}
                autoComplete="current-password"
              />
              <InsetField
                id="totp-disable-code"
                label="รหัส 6 หลักจากแอป"
                value={code}
                onChange={setCode}
                placeholder="123456"
                icon={<Smartphone size={16} aria-hidden="true" />}
                autoComplete="one-time-code"
              />
              {error && (
                <p className="text-[12px] font-medium text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-[var(--ink-secondary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] active:scale-[0.96]"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmDisable}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--danger)] px-6 py-2.5 text-[13px] font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 active:scale-[0.96]"
                >
                  {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  ปิดการใช้งาน 2FA
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPhase('disable')}
                className="inline-flex items-center justify-center rounded-full border border-[var(--hairline-strong)] px-5 py-2.5 text-[13px] font-bold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] active:scale-[0.96]"
              >
                ปิดการใช้งาน
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
            เมื่อเปิดใช้งาน คุณจะต้องกรอกรหัส 6 หลักจากแอป Authenticator
            ควบคู่กับรหัสผ่านทุกครั้งที่เข้าสู่ระบบ
          </p>
          {error && (
            <p className="text-[12px] font-medium text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={startSetup}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-[0.96]"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck size={14} aria-hidden="true" />
              )}
              เปิดใช้งาน 2FA
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export default SecurityCard;
