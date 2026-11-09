'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, MonitorSmartphone, RefreshCw, Smartphone } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { useToast } from '@/components/Toast/ToastProvider';
import { showConfirm } from '@/utils/sweetalert';
import { describeDevice, formatRelativeTime, parseUserAgent } from '@/utils/userAgent';

interface MySession {
  id: number;
  session_id: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_activity: string | null;
  created_at: string | null;
  expires_at: string | null;
}

const SESSIONS_ENDPOINT = '/api/v1/profile/sessions';

/**
 * The signed-in account's own devices.
 *
 * The API existed but nothing used it, so a user who spotted an unfamiliar
 * session had to ask an admin. This only ever sees the caller's rows (the
 * backend filters by the token's user id), and never offers to sign out the
 * current device — the logout button already does that.
 */
export function MyDevicesCard() {
  const toast = useToast();
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [error, setError] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSessionId(localStorage.getItem('session_id'));
  }, []);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetchWithAuth(SESSIONS_ENDPOINT);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiMessage(body, 'ไม่สามารถโหลดรายการอุปกรณ์ได้'));
      }
      setSessions(Array.isArray(body?.data) ? (body.data as MySession[]) : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการอุปกรณ์ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    async (session: MySession) => {
      setBusyId(session.session_id);
      try {
        const response = await fetchWithAuth(
          `${SESSIONS_ENDPOINT}/${encodeURIComponent(session.session_id)}`,
          { method: 'DELETE' },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(apiMessage(body, 'ไม่สามารถออกจากอุปกรณ์นี้ได้'));
        }
        toast.success('ออกจากอุปกรณ์นั้นแล้ว');
        await load(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'ไม่สามารถออกจากอุปกรณ์นี้ได้');
      } finally {
        setBusyId(null);
      }
    },
    [load, toast],
  );

  const revokeOthers = useCallback(async () => {
    const others = sessions.filter((s) => s.session_id !== currentSessionId);
    if (others.length === 0) return;

    const confirmed = await showConfirm(
      'ออกจากอุปกรณ์อื่นทั้งหมด?',
      `${others.length} อุปกรณ์จะต้องเข้าสู่ระบบใหม่ อุปกรณ์นี้ยังใช้งานได้`,
    );
    if (!confirmed.isConfirmed) return;

    setRevokingOthers(true);
    let failed = 0;
    try {
      for (const session of others) {
        const response = await fetchWithAuth(
          `${SESSIONS_ENDPOINT}/${encodeURIComponent(session.session_id)}`,
          { method: 'DELETE' },
        );
        if (!response.ok) failed += 1;
      }
      if (failed > 0) {
        toast.error(`ออกจากระบบไม่สำเร็จ ${failed} อุปกรณ์ กรุณาลองอีกครั้ง`);
      } else {
        toast.success('ออกจากอุปกรณ์อื่นทั้งหมดแล้ว');
      }
      await load(false);
    } finally {
      setRevokingOthers(false);
    }
  }, [currentSessionId, load, sessions, toast]);

  const others = sessions.filter((s) => s.session_id !== currentSessionId);

  return (
    <SectionCard
      icon={<MonitorSmartphone size={18} aria-hidden="true" />}
      iconBg="bg-[var(--accent-soft)]"
      iconColor="text-[var(--accent-text)]"
      iconRing="ring-[var(--accent-ring)]"
      title="อุปกรณ์ที่เข้าสู่ระบบ"
      subtitle="ตรวจสอบว่ามีอุปกรณ์ใดบ้างที่ใช้บัญชีของคุณอยู่ และออกจากอุปกรณ์ที่ไม่คุ้นเคย"
      badge={sessions.length > 0 ? `${sessions.length}` : undefined}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="รีเฟรชรายการอุปกรณ์"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 text-[12px] font-semibold text-[var(--ink)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-50"
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
          {others.length > 0 && (
            <button
              type="button"
              onClick={() => void revokeOthers()}
              disabled={revokingOthers}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3.5 text-[12px] font-semibold text-[var(--danger-ink)] transition-all hover:bg-[var(--danger-soft)] active:scale-[0.95] disabled:opacity-50"
            >
              {revokingOthers ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut size={14} aria-hidden="true" />
              )}
              ออกจากอุปกรณ์อื่น
            </button>
          )}
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-[12px] text-[var(--danger-ink)]">
          {error}
        </p>
      )}

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-6" role="status">
          <Loader2
            size={18}
            className="animate-spin text-[var(--ink-tertiary)]"
            aria-label="กำลังโหลดรายการอุปกรณ์"
          />
        </div>
      ) : sessions.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-[var(--ink-muted)]">
          ไม่พบอุปกรณ์ที่เข้าสู่ระบบอยู่
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const isCurrent = session.session_id === currentSessionId;
            const { relative, absolute } = formatRelativeTime(session.last_activity);
            const DeviceIcon = parseUserAgent(session.user_agent).isMobile ? Smartphone : Monitor;

            return (
              <li
                key={session.session_id}
                className="flex flex-wrap items-start gap-3 rounded-[14px] border border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-3.5 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface)] text-[var(--ink-secondary)] ring-1 ring-[var(--hairline-soft)]">
                  <DeviceIcon size={15} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                    <span className="truncate">
                      {describeDevice(session.user_agent, session.device_label)}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--success-ink)]">
                        อุปกรณ์นี้
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]" title={absolute}>
                    {session.ip_address || 'ไม่ทราบ IP'} · ใช้งานล่าสุด {relative}
                  </p>
                </div>

                {isCurrent ? (
                  <span className="text-[11px] font-medium text-[var(--ink-tertiary)]">
                    กำลังใช้งาน
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void revoke(session)}
                    disabled={busyId === session.session_id}
                    aria-label={`ออกจากอุปกรณ์ ${describeDevice(session.user_agent, session.device_label)}`}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 text-[11px] font-semibold text-[var(--danger-ink)] transition-all hover:bg-[var(--danger-soft)] active:scale-[0.95] disabled:opacity-50"
                  >
                    {busyId === session.session_id ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <LogOut size={13} aria-hidden="true" />
                    )}
                    ออก
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
