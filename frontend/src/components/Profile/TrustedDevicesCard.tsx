'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Monitor, RefreshCw, ShieldOff, Smartphone } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { useToast } from '@/components/Toast/ToastProvider';
import { showConfirm } from '@/utils/sweetalert';
import { describeDevice, formatRelativeTime, parseUserAgent } from '@/utils/userAgent';

interface TrustedDevice {
  id: number;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
}

const ENDPOINT = '/api/v1/auth/2fa/trusted-devices';

/**
 * Browsers that skip the 2FA prompt ("จดจำอุปกรณ์นี้ 30 วัน").
 *
 * Without this list a 30-day bypass is an invisible credential: the only way to
 * withdraw it was to change the password or reset 2FA, which also throws away
 * every other session. Revoking one row here makes that browser ask for a code
 * on its next sign-in and leaves everything else alone.
 */
export function TrustedDevicesCard() {
  const toast = useToast();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetchWithAuth(ENDPOINT);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiMessage(body, 'ไม่สามารถโหลดรายการอุปกรณ์ที่จดจำไว้ได้'));
      }
      setDevices(Array.isArray(body?.data) ? (body.data as TrustedDevice[]) : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการอุปกรณ์ที่จดจำไว้ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    async (device: TrustedDevice) => {
      const confirmed = await showConfirm(
        'เพิกถอนอุปกรณ์นี้?',
        'การเข้าสู่ระบบครั้งถัดไปบนอุปกรณ์นี้จะต้องกรอกรหัส 2FA อีกครั้ง',
      );
      if (!confirmed.isConfirmed) return;

      setBusyId(device.id);
      try {
        const response = await fetchWithAuth(`${ENDPOINT}/${device.id}`, {
          method: 'DELETE',
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(apiMessage(body, 'ไม่สามารถเพิกถอนอุปกรณ์นี้ได้'));
        }
        toast.success('เพิกถอนอุปกรณ์แล้ว');
        await load(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'ไม่สามารถเพิกถอนอุปกรณ์นี้ได้');
      } finally {
        setBusyId(null);
      }
    },
    [load, toast],
  );

  return (
    <SectionCard
      icon={<KeyRound size={18} aria-hidden="true" />}
      iconBg="bg-[var(--accent-soft)]"
      iconColor="text-[var(--accent-text)]"
      iconRing="ring-[var(--accent-ring)]"
      title="อุปกรณ์ที่จดจำไว้"
      subtitle="เบราว์เซอร์เหล่านี้ข้ามการกรอกรหัส 2FA จนกว่าจะหมดอายุ — เพิกถอนได้ทุกเมื่อ"
      badge={devices.length > 0 ? `${devices.length}` : undefined}
      action={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="รีเฟรชรายการอุปกรณ์ที่จดจำไว้"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 text-[12px] font-semibold text-[var(--ink)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-[12px] text-[var(--danger-ink)]">
          {error}
        </p>
      )}

      {loading && devices.length === 0 ? (
        <div className="flex items-center justify-center py-6" role="status">
          <Loader2
            size={18}
            className="animate-spin text-[var(--ink-tertiary)]"
            aria-label="กำลังโหลดรายการอุปกรณ์ที่จดจำไว้"
          />
        </div>
      ) : devices.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-[var(--ink-muted)]">
          ยังไม่มีอุปกรณ์ที่ถูกจดจำ — เปิดได้จากช่อง “จดจำอุปกรณ์นี้ 30 วัน” ตอนกรอกรหัส 2FA
        </p>
      ) : (
        <ul className="space-y-2">
          {devices.map((device) => {
            const created = formatRelativeTime(device.last_used_at ?? device.created_at);
            // Days away, not seconds: the exact instant is not actionable.
            const expires = formatRelativeTime(device.expires_at, { seconds: false });
            const DeviceIcon = parseUserAgent(device.user_agent).isMobile ? Smartphone : Monitor;

            return (
              <li
                key={device.id}
                className="flex flex-wrap items-start gap-3 rounded-apple-widget border border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-3.5 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-apple-md bg-[var(--surface)] text-[var(--ink-secondary)] ring-1 ring-[var(--hairline-soft)]">
                  <DeviceIcon size={15} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                    {describeDevice(device.user_agent, device.device_label)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                    {device.ip_address || 'ไม่ทราบ IP'} · ใช้ล่าสุด {created.relative}
                  </p>
                  <p className="text-[11px] text-[var(--ink-tertiary)]">
                    ข้ามการยืนยันถึง {expires.absolute}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void revoke(device)}
                  disabled={busyId === device.id}
                  aria-label={`เพิกถอน ${describeDevice(device.user_agent, device.device_label)}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 text-[11px] font-semibold text-[var(--danger-ink)] transition-all hover:bg-[var(--danger-soft)] active:scale-[0.95] disabled:opacity-50"
                >
                  {busyId === device.id ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldOff size={13} aria-hidden="true" />
                  )}
                  เพิกถอน
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export default TrustedDevicesCard;
