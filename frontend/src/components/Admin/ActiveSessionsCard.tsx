'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  LogOut,
  Monitor,
  MonitorSmartphone,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { formatRelativeTime, parseUserAgent } from '@/utils/userAgent';
import { showDeleteConfirm, showToast } from '@/utils/sweetalert';

export interface AdminSession {
  id: number;
  session_id: string;
  user_id: number;
  email: string | null;
  username: string | null;
  name: string | null;
  role: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  is_active: boolean;
  last_activity: string | null;
  created_at: string | null;
  expires_at: string | null;
}

/** Human label: the stored label when specific, otherwise browser + OS from the UA. */
export function describeDevice(session: AdminSession): string {
  const generic = new Set(['mobile', 'desktop', 'tablet']);
  if (session.device_label && !generic.has(session.device_label.toLowerCase())) {
    return session.device_label;
  }
  const parsed = parseUserAgent(session.user_agent);
  const parts = [parsed.browser, parsed.os].filter((part) => part && part !== 'ไม่ระบุ');
  if (parts.length > 0) return parts.join(' · ');
  return session.device_label || 'ไม่ระบุอุปกรณ์';
}

function accountLabel(session: AdminSession): string {
  return session.name || session.username || session.email || `ผู้ใช้ #${session.user_id}`;
}

/**
 * Who is signed in right now (admin only).
 *
 * One row per live session, not per account: the same person can be signed in
 * on a phone and a laptop, and the point of this panel is to see those devices
 * and force one out if it is not theirs.
 */
export default function ActiveSessionsCard() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSessionId(localStorage.getItem('session_id'));
  }, []);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/users/sessions?limit=100');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiMessage(body, 'ไม่สามารถโหลดรายการอุปกรณ์ได้'));
      }
      const rows = (await res.json()) as AdminSession[];
      const headerTotal = Number.parseInt(res.headers.get('X-Total-Count') ?? '', 10);
      setSessions(rows);
      setTotal(Number.isFinite(headerTotal) ? headerTotal : rows.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการอุปกรณ์ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const revoke = useCallback(
    async (session: AdminSession) => {
      const confirmed = await showDeleteConfirm(
        'บังคับออกจากระบบ?',
        `${accountLabel(session)} · ${describeDevice(session)} จะต้องเข้าสู่ระบบใหม่`
      );
      if (!confirmed.isConfirmed) return;

      setBusyId(session.session_id);
      try {
        const res = await fetchWithAuth(
          `/api/v1/users/sessions/${encodeURIComponent(session.session_id)}`,
          { method: 'DELETE' }
        );
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(apiMessage(body, 'ไม่สามารถยกเลิก session ได้'));
        }
        showToast('บังคับออกจากระบบเรียบร้อยแล้ว', 'success');
        await load(false);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'ไม่สามารถยกเลิก session ได้', 'error');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  return (
    <section
      aria-labelledby="active-sessions-heading"
      className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)] ring-1 ring-[var(--accent-soft)]">
            <MonitorSmartphone size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="active-sessions-heading"
              className="text-apple-title3 font-semibold text-[var(--ink)]"
            >
              อุปกรณ์ที่กำลังเข้าสู่ระบบ
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
              ใครออนไลน์อยู่ ใช้อุปกรณ์อะไร และเข้ามาล่าสุดเมื่อไร · รีเฟรชอัตโนมัติทุก 30 วินาที
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="รีเฟรชรายการอุปกรณ์"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 text-[12px] font-semibold text-[var(--ink)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={loading ? 'animate-spin' : undefined}
          />
          รีเฟรช
          {total !== null && (
            <span className="ml-0.5 rounded-full bg-[var(--surface-grouped)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--ink-secondary)]">
              {total}
            </span>
          )}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="border-b border-[var(--hairline-soft)] px-5 py-3 text-[12px] text-[var(--danger-ink)] sm:px-6"
        >
          {error}
        </p>
      )}

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-10" role="status">
          <Loader2
            size={20}
            className="animate-spin text-[var(--ink-tertiary)]"
            aria-label="กำลังโหลดรายการอุปกรณ์"
          />
        </div>
      ) : sessions.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12px] text-[var(--ink-muted)] sm:px-6">
          ยังไม่มีอุปกรณ์ที่เข้าสู่ระบบอยู่
        </p>
      ) : (
        <ul className="divide-y divide-[var(--hairline-soft)]">
          {sessions.map((session) => {
            const isCurrent = currentSessionId === session.session_id;
            const { relative, absolute } = formatRelativeTime(session.last_activity);
            const DeviceIcon = parseUserAgent(session.user_agent).isMobile ? Smartphone : Monitor;

            return (
              <li
                key={session.session_id}
                className="flex flex-wrap items-start gap-3 px-5 py-3.5 sm:px-6"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface-grouped)] text-[var(--ink-secondary)]">
                  <DeviceIcon size={16} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                    <span className="truncate">{accountLabel(session)}</span>
                    {session.role === 'admin' && (
                      <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                        แอดมิน
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--success-ink)]">
                        อุปกรณ์นี้
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--ink-secondary)]">
                    {describeDevice(session)}
                    {session.ip_address ? ` · ${session.ip_address}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-tertiary)]" title={absolute}>
                    ใช้งานล่าสุด {relative}
                    {session.email && session.email !== accountLabel(session) ? ` · ${session.email}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void revoke(session)}
                  disabled={busyId === session.session_id}
                  aria-label={`บังคับ ${accountLabel(session)} ออกจากอุปกรณ์นี้`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 text-[11px] font-semibold text-[var(--danger-ink)] transition-all hover:bg-[var(--danger-soft)] active:scale-[0.95] disabled:opacity-50"
                >
                  {busyId === session.session_id ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut size={13} aria-hidden="true" />
                  )}
                  ออกจากระบบ
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
