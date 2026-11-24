'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Loader2,
  LogOut,
  Monitor,
  MonitorSmartphone,
  RefreshCw,
  Search,
  Smartphone,
} from 'lucide-react';
import Select from '@/components/ui/Select';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { describeDevice, formatRelativeTime, parseUserAgent } from '@/utils/userAgent';
import { showRevokeConfirm, showToast } from '@/utils/sweetalert';

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
  is_active: boolean;
  is_online?: boolean;
  last_activity: string | null;
  created_at: string | null;
  expires_at: string | null;
}

function accountLabel(session: AdminSession): string {
  return session.name || session.username || session.email || `ผู้ใช้ #${session.user_id}`;
}

/** One account and every device it is signed in on. */
interface SessionGroup {
  key: string;
  label: string;
  role: string;
  email: string | null;
  sessions: AdminSession[];
}

/**
 * Who is signed in right now (admin only).
 *
 * Grouped by account, not one flat row per session: the same person signed in
 * from a laptop, a phone and a second browser is one entry with its devices
 * underneath, so a busy workspace reads as "who is here" instead of the same
 * name repeated with only the user agent changing. Each device keeps its own
 * "ออกจากระบบ" — forcing one out is still a per-session decision. Search and the
 * role filter run on the server; the page grows with "โหลดเพิ่ม" rather than
 * silently truncating.
 */
export default function ActiveSessionsCard({
  initialQuery = '',
}: {
  /** Account to filter on arrival, e.g. from /audit's "manage devices" link. */
  initialQuery?: string;
}) {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [role, setRole] = useState<'' | 'user' | 'admin'>('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setCurrentSessionId(localStorage.getItem('session_id'));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A second link from /audit (or any new `?sessions=…`) changes the prop
  // without remounting this card, so adopt it instead of keeping the old
  // account's filter on screen.
  useEffect(() => {
    if (!initialQuery) return;
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery.trim());
  }, [initialQuery]);

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

  /**
   * This browser's own session is gone: hand over to the app-wide
   * `auth-logout` handler (AuthProvider), which clears the local user, the
   * offline mirrors and redirects to /login. Reloading this list instead would
   * 401 and leave the admin staring at a page that can no longer act.
   */
  const endLocalSession = useCallback(
    (message: string, icon: 'success' | 'warning' = 'success') => {
      showToast(message, icon);
      window.dispatchEvent(new Event('auth-logout'));
    },
    [],
  );

  const revoke = useCallback(
    async (session: AdminSession) => {
      // Forcing out this very device ends the admin's own session, so the
      // prompt has to say that before it happens.
      const scope = `${accountLabel(session)} · ${describeDevice(session.user_agent, session.device_label)} จะต้องเข้าสู่ระบบใหม่`;
      const confirmed = await showRevokeConfirm(
        'บังคับออกจากระบบ?',
        currentSessionId === session.session_id
          ? `${scope} — อุปกรณ์นี้คือเครื่องที่คุณกำลังใช้อยู่ จะหลุดจากระบบทันที และต้องเข้าสู่ระบบใหม่`
          : scope,
      );
      if (!confirmed.isConfirmed) return;
      // Recorded next to the revoke on /audit; blank means "no reason given".
      const reason = typeof confirmed.value === 'string' ? confirmed.value.trim() : '';

      setBusyId(session.session_id);
      try {
        const query = new URLSearchParams();
        if (reason) query.set('reason', reason);
        const queryString = query.toString();
        const res = await fetchWithAuth(
          `/api/v1/users/sessions/${encodeURIComponent(session.session_id)}${queryString ? `?${queryString}` : ''}`,
          { method: 'DELETE' },
        );
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(apiMessage(body, 'ไม่สามารถยกเลิก session ได้'));
        }
        if (currentSessionId === session.session_id) {
          endLocalSession('ออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่');
          return;
        }
        showToast('บังคับออกจากระบบเรียบร้อยแล้ว', 'success');
        await load(false);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'ไม่สามารถยกเลิก session ได้', 'error');
      } finally {
        setBusyId(null);
      }
    },
    [currentSessionId, endLocalSession, load],
  );

  // Same endpoint as the per-device button, once per session of this account.
  // Revoking a session the server already dropped is harmless, so a partial
  // failure only needs to be counted, not rolled back.
  const revokeAll = useCallback(
    async (group: SessionGroup) => {
      // Revoking your own account's devices includes the browser doing the
      // revoking: the admin is signed out mid-action, so say so up front.
      const signOutHere = currentSessionId
        ? group.sessions.some((session) => session.session_id === currentSessionId)
        : false;
      const scope = `${group.label} จะต้องเข้าสู่ระบบใหม่บนทุกอุปกรณ์ (${group.sessions.length} อุปกรณ์)`;
      const confirmed = await showRevokeConfirm(
        'บังคับออกจากทุกอุปกรณ์?',
        signOutHere
          ? `${scope} รวมอุปกรณ์นี้ด้วย — คุณจะหลุดจากระบบทันที และต้องเข้าสู่ระบบใหม่`
          : scope,
      );
      if (!confirmed.isConfirmed) return;
      // One reason covers the whole batch: the admin made a single decision.
      const reason = typeof confirmed.value === 'string' ? confirmed.value.trim() : '';
      const query = new URLSearchParams();
      if (reason) query.set('reason', reason);
      const queryString = query.toString();
      const querySuffix = queryString ? `?${queryString}` : '';

      setBusyGroup(group.key);
      try {
        const results = await Promise.all(
          group.sessions.map(async (session) => ({
            session,
            removed: await fetchWithAuth(
              `/api/v1/users/sessions/${encodeURIComponent(session.session_id)}${querySuffix}`,
              { method: 'DELETE' },
            ).then(
              (res) => res.ok,
              () => false,
            ),
          })),
        );
        const failed = results.filter((result) => !result.removed).length;
        // This browser's session is dead as soon as its own delete lands, even
        // when another device of the same account refused: staying here would
        // only 401 behind a page that still looks usable.
        const ownGone = results.some(
          (result) => result.removed && result.session.session_id === currentSessionId,
        );
        if (ownGone) {
          endLocalSession(
            failed === 0
              ? 'ออกจากทุกอุปกรณ์แล้ว กรุณาเข้าสู่ระบบใหม่'
              : `เครื่องนี้หลุดจากระบบแล้ว · อีก ${failed} อุปกรณ์ออกไม่สำเร็จ`,
            failed === 0 ? 'success' : 'warning',
          );
          return;
        }
        if (failed === 0) {
          showToast('บังคับออกจากทุกอุปกรณ์เรียบร้อยแล้ว', 'success');
        } else {
          showToast(
            `ออกได้ ${results.length - failed} อุปกรณ์ อีก ${failed} อุปกรณ์ล้มเหลว`,
            'error',
          );
        }
        await load(false);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'ไม่สามารถยกเลิก session ได้', 'error');
      } finally {
        setBusyGroup(null);
      }
    },
    [currentSessionId, endLocalSession, load],
  );

  const groups = useMemo<SessionGroup[]>(() => {
    const byAccount = new Map<string, SessionGroup>();
    for (const session of sessions) {
      const key = String(session.user_id ?? session.email ?? session.session_id);
      const existing = byAccount.get(key);
      if (existing) {
        existing.sessions.push(session);
        continue;
      }
      byAccount.set(key, {
        key,
        label: accountLabel(session),
        role: session.role,
        email: session.email,
        sessions: [session],
      });
    }
    return Array.from(byAccount.values());
  }, [sessions]);

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
            placeholder="ค้นหาชื่อ อีเมล หรืออุปกรณ์"
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
        <div className="px-5 py-8 text-center text-[12px] text-[var(--ink-muted)] sm:px-6">
          {initialQuery && debouncedQuery === initialQuery.trim() ? (
            // Arrived from an /audit row: "no devices" means this account is
            // signed out, not that a search misspelled something. Offer the way
            // back to the history that sent the admin here.
            <>
              <p>บัญชีนี้ไม่ได้เข้าสู่ระบบอยู่บนอุปกรณ์ใดเลย — อาจออกจากระบบไปแล้ว หรือถูกบังคับออก</p>
              <Link
                href={`/audit?q=${encodeURIComponent(initialQuery.trim())}`}
                className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--accent-soft)] active:scale-[0.95]"
              >
                <FileText size={13} aria-hidden="true" /> ดูบันทึกกิจกรรมของบัญชีนี้
              </Link>
            </>
          ) : debouncedQuery || role ? (
            'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง'
          ) : (
            'ยังไม่มีอุปกรณ์ที่เข้าสู่ระบบอยู่'
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--hairline-soft)]">
          {groups.map((group) => (
            <li key={group.key} className="px-5 py-3.5 sm:px-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--ink)]">
                  {group.label}
                </span>
                {group.role === 'admin' && (
                  <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                    แอดมิน
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--ink-tertiary)]">
                  {group.sessions.length} อุปกรณ์
                </span>
                <button
                  type="button"
                  onClick={() => void revokeAll(group)}
                  disabled={busyGroup === group.key}
                  aria-label={`บังคับ ${group.label} ออกจากทุกอุปกรณ์`}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--hairline)] px-2.5 text-[11px] font-semibold text-[var(--danger-ink)] transition-all hover:bg-[var(--danger-soft)] active:scale-[0.95] disabled:opacity-50"
                >
                  {busyGroup === group.key ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut size={12} aria-hidden="true" />
                  )}
                  ออกจากทุกอุปกรณ์
                </button>
              </div>
              {group.email && group.email !== group.label && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--ink-tertiary)]">{group.email}</p>
              )}

              <ul className="mt-2 overflow-hidden rounded-apple-md border border-[var(--hairline-soft)] bg-[var(--surface-subtle)] divide-y divide-[var(--hairline-soft)]">
                {group.sessions.map((session) => {
                  const isCurrent = currentSessionId === session.session_id;
                  const { relative, absolute } = formatRelativeTime(session.last_activity);
                  const device = describeDevice(session.user_agent, session.device_label);
                  const DeviceIcon = parseUserAgent(session.user_agent).isMobile
                    ? Smartphone
                    : Monitor;

                  return (
                    <li
                      key={session.session_id}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-apple-md bg-[var(--surface)] text-[var(--ink-secondary)]">
                        <DeviceIcon size={15} aria-hidden="true" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[var(--ink)]">
                          <span className="truncate">{device}</span>
                          {session.is_online && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--success-ink)]">
                              <span
                                aria-hidden="true"
                                className="h-1 w-1 rounded-full bg-[var(--success)]"
                              />
                              ออนไลน์
                            </span>
                          )}
                          {isCurrent && (
                            <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                              อุปกรณ์นี้
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--ink-tertiary)]" title={absolute}>
                          ใช้งานล่าสุด {relative}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void revoke(session)}
                        disabled={busyId === session.session_id}
                        aria-label={`บังคับ ${group.label} ออกจาก ${device}`}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-[11px] font-semibold text-[var(--danger-ink)] transition-all hover:bg-[var(--danger-soft)] active:scale-[0.95] disabled:opacity-50"
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
            </li>
          ))}
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
