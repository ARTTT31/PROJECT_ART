'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Globe,
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
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
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

  // The page is admin-only; a regular account that types the URL is sent back.
  useEffect(() => {
    if (isClient && user && user.role !== 'admin') router.replace('/dashboard');
  }, [isClient, user, router]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // A new filter always starts from the first page, otherwise the user can land
  // on an empty page 4 of a 2-page result.
  useEffect(() => {
    setPage(1);
  }, [action, debouncedSearch, dateFrom, dateTo]);

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
    if (!isClient || user?.role !== 'admin') return;
    void load();
  }, [isClient, user?.role, load]);

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
                    'ไฟล์จะมีทุกรายการที่ตรงกับตัวกรอง ({count} รายการ) พร้อมชื่อผู้ใช้ อุปกรณ์ และไอพี เฉพาะผู้ดูแลระบบควรเปิดดู',
                    'The file will contain every item matching the filters ({count}), including names, devices and IP addresses.',
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
                    formatDateTime(entry.created_at),
                    actionLabel(entry.action),
                    entry.user?.name ?? entry.user?.email ?? tr('ระบบ', 'System'),
                    entry.user?.email ?? '',
                    deviceLabel(entry.user_agent),
                    entry.ip_address ?? '',
                    entry.details ?? '',
                  ]);
                  downloadCsv(
                    auditExportFilename(dateFrom, dateTo),
                    toCsv(
                      [
                        tr('วันเวลา (ไทย)', 'Date and time (Asia/Bangkok)'),
                        tr('กิจกรรม', 'Activity'),
                        tr('ผู้ใช้', 'User'),
                        tr('อีเมล', 'Email'),
                        tr('อุปกรณ์', 'Device'),
                        'IP',
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('ค้นหารายละเอียด ชื่อ หรืออีเมล', 'Search details, name or email')}
              aria-label={tr('ค้นหาบันทึกกิจกรรม', 'Search the activity log')}
              className="w-full rounded-apple-widget border border-[var(--hairline-strong)] bg-[var(--surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
          </div>
          <Select
            value={action}
            onChange={setAction}
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
                className="rounded-apple-widget bg-[var(--surface-subtle)] p-3.5"
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
                    {entry.ip_address && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Globe size={12} aria-hidden="true" /> {entry.ip_address}
                      </span>
                    )}
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
