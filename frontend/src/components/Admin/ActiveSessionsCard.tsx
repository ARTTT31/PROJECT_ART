'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, MonitorSmartphone, RefreshCw, Search, Smartphone } from 'lucide-react';
import Select from '@/components/ui/Select';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { describeDevice, formatRelativeTime, parseUserAgent } from '@/utils/userAgent';
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

function accountLabel(session: AdminSession): string {
  return session.name || session.username || session.email || `ผู้ใช้ #${session.user_id}`;
}

/**
 * Who is signed in right now (admin only).
 *
 * One row per live session, not per account: the same person can be signed in
 * on a phone and a laptop, and the point of this panel is to see those devices
 * and force one out if it is not theirs. Search and the role filter run on the
 * server; the page grows with "โหลดเพิ่ม" rather than silently truncating.
 */
export default function ActiveSessionsCard() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [role, setRole] = useState<'' | 'user' | 'admin'>('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setCurrentSessionId(localStorage.getItem('session_id'));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A new filter starts a new page window; keeping skip-based "load more"
  // across a filter change would mix two result sets.
  useEffect(() => {
    setLimit(50);
  }, [debouncedQuery, role]);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (debouncedQuery) params.set('q', debouncedQuery);
        if (role) params.set('role', role);

        const res = await fetchWithAuth(`/api/v1/users/sessions?${params.toString()}`);
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
    },
    [debouncedQuery, limit, role],
  );

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
        `${accountLabel(session)} · ${describeDevice(session.user_agent, session.device_label)} จะต้องเข้าสู่ระบบใหม่`,
      );
      if (!confirmed.isConfirmed) return;

      setBusyId(session.session_id);
      try {
        const res = await fetchWithAuth(
          `/api/v1/users/sessions/${encodeURIComponent(session.session_id)}`,
          { method: 'DELETE' },
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
    [load],
  );

  const hasMore = total !== null && sessions.length < total;

  return (
    <section
      aria-labelledby="active-sessions-heading"
      className="overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--accent-soft)] text-[var(--accent-text)] ring-1 ring-[var(--accent-soft)]">
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

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline-soft)] px-5 py-3 sm:px-6">
        <label className="relative min-w-[180px] flex-1">
          <span className="sr-only">ค้นหาอุปกรณ์หรือผู้ใช้</span>
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อ อีเมล อุปกรณ์ หรือ IP"
            className="h-9 w-full rounded-full border border-[var(--hairline)] bg-[var(--surface-grouped)] pl-9 pr-3 text-[12px] font-medium text-[var(--ink)] outline-hidden transition-all placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>

        <Select
          id="session-role-filter"
          ariaLabel="กรองตามบทบาท"
          value={role}
          onChange={(value) => setRole(value as '' | 'user' | 'admin')}
          options={[
            { value: '', label: 'ทุกบทบาท' },
            { value: 'admin', label: 'แอดมิน' },
            { value: 'user', label: 'ผู้ใช้ทั่วไป' },
          ]}
          size="sm"
          pill
          className="min-w-[132px]"
        />
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
          {debouncedQuery || role
            ? 'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง'
            : 'ยังไม่มีอุปกรณ์ที่เข้าสู่ระบบอยู่'}
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md bg-[var(--surface-grouped)] text-[var(--ink-secondary)]">
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
                    {describeDevice(session.user_agent, session.device_label)}
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

      {hasMore && (
        <div className="border-t border-[var(--hairline-soft)] px-5 py-3 text-center sm:px-6">
          <button
            type="button"
            onClick={() => setLimit((current) => Math.min(current + 50, 200))}
            disabled={loading}
            className="inline-flex h-8 items-center rounded-full border border-[var(--hairline)] px-4 text-[12px] font-semibold text-[var(--ink)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-50"
          >
            {loading ? 'กำลังโหลด…' : `โหลดเพิ่ม (${sessions.length}/${total})`}
          </button>
        </div>
      )}
    </section>
  );
}
