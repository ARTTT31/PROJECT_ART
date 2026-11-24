'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Monitor,
  MonitorSmartphone,
  RotateCw,
  Search,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Select from '@/components/ui/Select';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { ACTION_LABELS } from '@/lib/audit/actionLabels';
import { auditExportFilename } from '@/lib/audit/exportFilename';
import { downloadCsv, toCsv } from '@/lib/csv';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { parseUserAgent } from '@/utils/userAgent';
import { showConfirm, showToast } from '@/utils/sweetalert';

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  details: string | null;
  user_agent: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
  /** Who the action was performed on, when it differs from `user`. */
  target_user: { id: number; name: string; email: string } | null;
}

interface PaginatedResponse {
  items: AuditLogEntry[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Every row matching the filters, not just the page the table is showing. */
interface AuditLogExportResponse {
  items: AuditLogEntry[];
  total: number;
  exported: number;
  truncated: boolean;
}

const PAGE_SIZE = 20;

const ACTION_OPTIONS = Object.keys(ACTION_LABELS);

function actionTone(action: string) {
  if (action.includes('FAIL') || action.includes('BLOCK') || action.includes('DELETE')) {
    return 'bg-[var(--danger-soft)] text-[var(--danger-ink)]';
  }
  if (action.includes('ADMIN') || action.includes('BRANDING')) {
    return 'bg-[var(--info-soft)] text-[var(--info-ink)]';
  }
  if (action.startsWith('LOGIN') || action === 'LOGOUT') {
    return 'bg-[var(--accent-soft)] text-[var(--accent-text)]';
  }
  return 'bg-[var(--success-soft)] text-[var(--success-ink)]';
}

/**
 * Parse an audit timestamp as the UTC instant it is.
 *
 * `audit_logs.created_at` is a naive `DateTime` filled from `utcnow()`, so the
 * API sends `2026-11-16T08:37:03` with no offset. `new Date()` reads that as
 * local time, which made every row display the UTC clock — seven hours behind
 * the Thai time in the header. Anything without an explicit offset is UTC.
 */
function asInstant(value: string): Date {
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasOffset ? value : `${value}Z`);
}

/** Full date and time in Bangkok time, e.g. "16 พ.ย. 2569 15:37:03". */
function formatDateTime(value: string) {
  const date = asInstant(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** "Opera 140 · Windows 10/11" from the stored user agent, or a labelled fallback. */
function deviceLabel(userAgent: string | null) {
  if (!userAgent) return 'ไม่ระบุอุปกรณ์';
  const { browser, os } = parseUserAgent(userAgent);
  // A client that sends no recognisable token (curl, a health check) gets one
  // label instead of "ไม่ระบุ · ไม่ระบุ".
  const parts = [browser, os].filter((part) => part && part !== 'ไม่ระบุ');
  return parts.length > 0 ? parts.join(' · ') : 'ไม่ระบุอุปกรณ์';
}

export default function AuditPage() {
  const { user, status } = useAuth();
  const { tr } = useI18n();
  const router = useRouter();
  const isClient = status !== 'loading';

  const actionLabel = (action: string) => {
    const pair = ACTION_LABELS[action];
    return pair ? tr(pair.th, pair.en) : action;
  };

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [urlRestored, setUrlRestored] = useState(false);
  // A row anchor (`#entry-42`) is part of the address an admin shares: it is
  // what points at the one entry being discussed, so the filter sync below
  // carries it along instead of rewriting the URL without it.
  const [hash, setHash] = useState('');

  // The page is admin-only; a regular account that types the URL is sent back.
  useEffect(() => {
    if (isClient && user && user.role !== 'admin') router.replace('/dashboard');
  }, [isClient, user, router]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Filters and page live in the URL: the view can be shared, survives a
  // reload, and comes back intact after the /admin detour. Read once on mount,
  // before the first fetch, so no unfiltered request goes out.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextAction = params.get('action') ?? '';
    const nextQuery = params.get('q') ?? '';
    const nextFrom = params.get('dateFrom') ?? '';
    const nextTo = params.get('dateTo') ?? '';
    const nextPage = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

    if (nextAction) setAction(nextAction);
    if (nextQuery) {
      setSearch(nextQuery);
      setDebouncedSearch(nextQuery);
    }
    if (nextFrom) setDateFrom(nextFrom);
    if (nextTo) setDateTo(nextTo);
    if (nextPage > 1) setPage(nextPage);
    setHash(window.location.hash);
    setUrlRestored(true);
  }, []);

  // The anchor can also be set after mount — a link inside the page, the
  // address bar, or the browser's back/forward. Without this the next filter
  // change would rebuild the URL from the mount-time value and drop it.
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Keep the address bar in step. Only after the mount read, or it would wipe
  // the incoming query before it is applied.
  useEffect(() => {
    if (!urlRestored) return;
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    const target = `${query ? `/audit?${query}` : '/audit'}${hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    // Already the same address: replacing would only add a history entry the
    // admin has to press back through.
    if (target === current) return;
    router.replace(target, { scroll: false });
  }, [urlRestored, action, debouncedSearch, dateFrom, dateTo, page, hash, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (action) params.set('action', action);
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetchWithAuth(`/api/v1/audit/paginated?${params.toString()}`);
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? tr('บัญชีนี้ไม่มีสิทธิ์ดูบันทึกกิจกรรม', 'This account cannot view the activity log')
            : `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as PaginatedResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
      setHasNext(Boolean(data.hasNext));
      setHasPrev(Boolean(data.hasPrev));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tr('โหลดบันทึกกิจกรรมไม่สำเร็จ', 'Could not load the activity log'),
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, action, debouncedSearch, dateFrom, dateTo, tr]);

  useEffect(() => {
    if (!urlRestored || !isClient || user?.role !== 'admin') return;
    void load();
  }, [urlRestored, isClient, user?.role, load]);

  // Bring a linked row into view. On arrival the anchor is already in the URL
  // but the rows are still being fetched, so scrolling on mount would find
  // nothing; this waits for the list, then scrolls once per anchor so later
  // refetches do not yank the page away from wherever the admin is reading.
  //
  // A row that is already fully on screen is left where it is: the first entry
  // of the page is visible on arrival, and centring it would scroll the filters
  // the admin needs next off the top of the page.
  const anchoredOnce = useRef<string | null>(null);
  useEffect(() => {
    if (!urlRestored || loading) return;
    if (!/^#entry-\d+$/.test(hash)) return;
    if (anchoredOnce.current === hash) return;
    const row = document.getElementById(hash.slice(1));
    if (!row) return;
    anchoredOnce.current = hash;
    const rect = row.getBoundingClientRect();
    const alreadyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!alreadyVisible) row.scrollIntoView({ block: 'start' });
  }, [urlRestored, loading, hash, items]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return tr('ไม่มีรายการ', 'No items');
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = start + items.length - 1;
    return tr('แสดง {start}–{end} จาก {total} รายการ', 'Showing {start}–{end} of {total}', {
      start,
      end,
      total,
    });
  }, [page, items.length, total, tr]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <section className="rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <FileText size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight text-[var(--ink)]">
                {tr('บันทึกกิจกรรม', 'Activity log')}
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                {tr(
                  'ประวัติการเข้าสู่ระบบ การแก้ไขข้อมูล และการจัดการบัญชี — เห็นเฉพาะผู้ดูแลระบบ',
                  'Sign-ins, data changes and account management — visible to admins only',
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={async () => {
                // The file leaves the app with account identifiers in it, so
                // the download waits for an explicit confirmation. It covers
                // every row matching the filters: the visible 20 are a page,
                // and a file that silently stops there is not evidence.
                const confirmed = await showConfirm(
                  tr('ยืนยันการส่งออกไฟล์ CSV?', 'Export this CSV file?'),
                  tr(
                    'ไฟล์จะมีทุกรายการที่ตรงกับตัวกรอง ({count} รายการ) พร้อมชื่อผู้ใช้ อุปกรณ์ และรายละเอียด เฉพาะผู้ดูแลระบบควรเปิดดู',
                    'The file will contain every item matching the filters ({count}), including names, devices and details.',
                    { count: total },
                  ),
                );
                if (!confirmed.isConfirmed) return;

                setExporting(true);
                try {
                  const params = new URLSearchParams();
                  if (action) params.set('action', action);
                  if (debouncedSearch) params.set('q', debouncedSearch);
                  if (dateFrom) params.set('dateFrom', dateFrom);
                  if (dateTo) params.set('dateTo', dateTo);

                  const res = await fetchWithAuth(`/api/v1/audit/export?${params.toString()}`);
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const data = (await res.json()) as AuditLogExportResponse;

                  const rows = data.items.map((entry) => [
                    entry.id,
                    formatDateTime(entry.created_at),
                    actionLabel(entry.action),
                    entry.user?.name ?? entry.user?.email ?? tr('ระบบ', 'System'),
                    entry.user?.email ?? '',
                    entry.target_user?.name ?? entry.target_user?.email ?? '',
                    deviceLabel(entry.user_agent),
                    entry.details ?? '',
                  ]);
                  downloadCsv(
                    auditExportFilename(dateFrom, dateTo),
                    toCsv(
                      [
                        'ID',
                        tr('วันเวลา (ไทย)', 'Date and time (Asia/Bangkok)'),
                        tr('กิจกรรม', 'Activity'),
                        tr('ผู้ใช้', 'User'),
                        tr('อีเมล', 'Email'),
                        tr('เป้าหมาย', 'Target'),
                        tr('อุปกรณ์', 'Device'),
                        tr('รายละเอียด', 'Details'),
                      ],
                      rows,
                    ),
                  );
                  // Say what the file actually holds: a server-side ceiling must
                  // not make a partial export look like the whole history.
                  showToast(
                    data.truncated
                      ? tr(
                          'ส่งออก {exported} จาก {total} รายการ (ถึงเพดานการส่งออก)',
                          'Exported {exported} of {total} items (export limit reached)',
                          { exported: data.exported, total: data.total },
                        )
                      : tr(
                          'ส่งออก {exported} จาก {total} รายการ',
                          'Exported {exported} of {total} items',
                          { exported: data.exported, total: data.total },
                        ),
                    data.truncated ? 'warning' : 'success',
                  );
                } catch (err) {
                  showToast(
                    err instanceof Error ? err.message : tr('ส่งออกไม่สำเร็จ', 'Export failed'),
                    'error',
                  );
                } finally {
                  setExporting(false);
                }
              }}
              disabled={items.length === 0 || exporting}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] disabled:opacity-40"
              title={tr('ส่งออกทุกรายการที่ตรงกับตัวกรอง', 'Export every item matching the filters')}
            >
              <Download size={14} aria-hidden="true" /> {tr('ส่งออก CSV', 'Export CSV')}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)]"
            >
              <RotateCw size={14} aria-hidden="true" /> {tr('รีเฟรช', 'Refresh')}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                // A new term starts a new result set, never page 4 of it.
                setPage(1);
              }}
              placeholder={tr('ค้นหารายละเอียด ชื่อ หรืออีเมล', 'Search details, name or email')}
              aria-label={tr('ค้นหาบันทึกกิจกรรม', 'Search the activity log')}
              className="w-full rounded-apple-widget border border-[var(--hairline-strong)] bg-[var(--surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
          </div>
          <Select
            value={action}
            onChange={(value) => {
              setAction(value);
              setPage(1);
            }}
            ariaLabel="กรองตามประเภทกิจกรรม"
            size="md"
            options={[
              { value: '', label: 'ทุกประเภทกิจกรรม' },
              ...ACTION_OPTIONS.map((key) => ({
                value: key,
                label: tr(ACTION_LABELS[key].th, ACTION_LABELS[key].en),
              })),
            ]}
            className="w-full sm:w-60"
          />

          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(range) => {
              setDateFrom(range.from);
              setDateTo(range.to);
              setPage(1);
            }}
            ariaLabel="กรองตามช่วงวันที่"
            className="w-full sm:w-64"
          />
        </div>
      </section>

      <section className="rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-5">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[240px] items-center justify-center"
          >
            <div className="w-full space-y-2.5 animate-pulse py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-apple-widget bg-[var(--surface-subtle)] p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-20 rounded-full bg-[var(--surface-chip)]" />
                      <div className="h-4 w-28 rounded-apple-md bg-[var(--surface-chip)]" />
                    </div>
                    <div className="h-3.5 w-56 rounded-apple-md bg-[var(--surface-chip)]" />
                  </div>
                  <div className="h-4 w-24 rounded-apple-md bg-[var(--surface-chip)]" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-apple-widget border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4 text-[13px] text-[var(--danger-ink)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-apple-widget border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-4 text-center text-[13px] text-[var(--ink-tertiary)]">
            <FileText size={22} className="mb-2 text-[var(--ink-faint)]" aria-hidden="true" />
            <span>ไม่พบบันทึกกิจกรรมที่ตรงกับเงื่อนไข</span>
            {(search || action || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setAction('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--hairline)] hover:bg-[var(--accent)]/10 transition-colors active:scale-[0.95]"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((entry) => (
              <li
                key={entry.id}
                id={`entry-${entry.id}`}
                className="scroll-mt-4 rounded-apple-widget bg-[var(--surface-subtle)] p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${actionTone(entry.action)}`}
                    >
                      {actionLabel(entry.action)}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--ink)]">
                      {entry.user?.name || entry.user?.email || 'ระบบ'}
                    </span>
                    {entry.user?.email && entry.user.email !== entry.user.name && (
                      <span className="truncate text-[12px] text-[var(--ink-tertiary)]">
                        {entry.user.email}
                      </span>
                    )}
                    {entry.target_user && (
                      <span className="rounded-full bg-[var(--surface-chip)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-secondary)]">
                        {tr('เป้าหมาย', 'Target')}:{' '}
                        {entry.target_user.name || entry.target_user.email}
                      </span>
                    )}
                    {/* Seen something worth acting on? The admin console's
                        device card takes the account through `?sessions=…`, so
                        this needs no copy/paste and no second search. */}
                    {entry.user && (
                      <Link
                        href={`/admin?sessions=${encodeURIComponent(entry.user.email)}`}
                        aria-label={tr(
                          'ดูอุปกรณ์ที่เข้าสู่ระบบของ {name} ในหน้าจัดการระบบ',
                          'View signed-in devices for {name} in the admin console',
                          { name: entry.user.name || entry.user.email },
                        )}
                        title={tr(
                          'เปิดหน้าจัดการระบบ กรองเฉพาะบัญชีนี้',
                          'Open the admin console filtered to this account',
                        )}
                        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)] transition-all hover:bg-[var(--accent-soft)] active:scale-[0.95]"
                      >
                        <MonitorSmartphone size={12} aria-hidden="true" />
                        {tr('จัดการอุปกรณ์', 'Manage devices')}
                      </Link>
                    )}
                  </div>
                  {entry.details && (
                    <p className="mt-1 break-words text-[13px] leading-relaxed text-[var(--ink-muted)]">
                      {entry.details}
                    </p>
                  )}
                  {/* Time, device and address are part of the record itself, so
                      they are shown on the page instead of only in the export. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-tertiary)]">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock size={12} aria-hidden="true" /> {formatDateTime(entry.created_at)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={entry.user_agent ?? undefined}
                    >
                      <Monitor size={12} aria-hidden="true" /> {deviceLabel(entry.user_agent)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3 text-[12px] text-[var(--ink-muted)]">
          <span>{rangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!hasPrev || loading}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-grouped)] px-3 py-1.5 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] disabled:opacity-40"
            >
              <ChevronLeft size={14} aria-hidden="true" /> ก่อนหน้า
            </button>
            <span className="tabular-nums">
              หน้า {page}/{lastPage}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNext || loading}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-grouped)] px-3 py-1.5 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] disabled:opacity-40"
            >
              ถัดไป <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
