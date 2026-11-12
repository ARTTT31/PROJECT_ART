'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RotateCw,
  Search,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Select from '@/components/ui/Select';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { datedFilename, downloadCsv, toCsv } from '@/lib/csv';
import { useI18n } from '@/lib/i18n/I18nProvider';

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

const PAGE_SIZE = 20;

// Thai/English labels for the actions the backend actually writes. Anything
// else is shown as its raw key so a new action is still visible before it is
// translated.
const ACTION_LABELS: Record<string, { th: string; en: string }> = {
  LOGIN_SUCCESS: { th: 'เข้าสู่ระบบ', en: 'Signed in' },
  LOGIN_FAILED: { th: 'เข้าสู่ระบบไม่สำเร็จ', en: 'Sign-in failed' },
  LOGOUT: { th: 'ออกจากระบบ', en: 'Signed out' },
  USER_REGISTER: { th: 'สมัครสมาชิก', en: 'Signed up' },
  USER_REGISTER_PENDING: { th: 'สมัครสมาชิก (รออนุมัติ)', en: 'Sign-up (pending approval)' },
  USER_REGISTER_RESUBMIT: { th: 'ส่งคำขอสมัครใหม่', en: 'Sign-up resubmitted' },
  USER_REGISTER_BLOCKED: { th: 'ถูกปฏิเสธการสมัคร', en: 'Sign-up rejected' },
  USER_REGISTER_DUPLICATE: { th: 'สมัครซ้ำ', en: 'Duplicate sign-up' },
  PASSWORD_RESET_REQUESTED: { th: 'ขอลืมรหัสผ่าน', en: 'Password reset requested' },
  PASSWORD_RESET_COMPLETED: { th: 'ตั้งรหัสผ่านใหม่', en: 'Password reset' },
  PASSWORD_CHANGE: { th: 'เปลี่ยนรหัสผ่าน', en: 'Password changed' },
  EMAIL_VERIFIED: { th: 'ยืนยันอีเมล', en: 'Email verified' },
  EMAIL_VERIFICATION_RESENT: { th: 'ส่งอีเมลยืนยันอีกครั้ง', en: 'Verification email resent' },
  PROFILE_UPDATE: { th: 'แก้ไขโปรไฟล์', en: 'Profile updated' },
  AVATAR_UPLOAD: { th: 'เปลี่ยนรูปโปรไฟล์', en: 'Avatar changed' },
  USER_SELF_DELETE: { th: 'ลบบัญชีตัวเอง', en: 'Account deleted' },
  UPDATE_BRANDING: { th: 'แก้ไขแบรนด์ระบบ', en: 'Branding updated' },
  UPLOAD_BRAND_LOGO: { th: 'เปลี่ยนโลโก้ระบบ', en: 'System logo changed' },
  UPLOAD_WORKSPACE_LOGO: { th: 'เปลี่ยนโลโก้ทีม', en: 'Workspace logo changed' },
  ADMIN_USER_CREATE: { th: 'แอดมินสร้างผู้ใช้', en: 'Admin created user' },
  ADMIN_USER_CREATE_HYBRID: { th: 'แอดมินสร้างผู้ใช้ (กำหนดเอง)', en: 'Admin created user (custom)' },
  ADMIN_USER_UPDATE: { th: 'แอดมินแก้ไขผู้ใช้', en: 'Admin updated user' },
  ADMIN_USER_DELETE: { th: 'แอดมินลบผู้ใช้', en: 'Admin deleted user' },
  ADMIN_USER_RESTORE: { th: 'แอดมินกู้คืนผู้ใช้', en: 'Admin restored user' },
  ADMIN_USER_APPROVE: { th: 'อนุมัติสมาชิก', en: 'Member approved' },
  ADMIN_USER_REJECT: { th: 'ปฏิเสธสมาชิก', en: 'Member rejected' },
  AUTH_UPDATE_COMPANY_HOLIDAYS: { th: 'บันทึกวันหยุดบริษัท', en: 'Company holidays saved' },
  UPDATE_COMPANY_HOLIDAYS: { th: 'บันทึกวันหยุดบริษัท', en: 'Company holidays saved' },
  DELETE_COMPANY_HOLIDAYS: { th: 'ลบปฏิทินวันหยุดบริษัท', en: 'Company holidays deleted' },
  UPDATE_PAGE_ACCESS: { th: 'ตั้งค่าหน้าที่เปิดใช้งาน', en: 'Page access updated' },
};

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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
              onClick={() => {
                const rows = items.map((entry) => [
                  formatDate(entry.created_at),
                  actionLabel(entry.action),
                  entry.user?.name ?? entry.user?.email ?? tr('ระบบ', 'System'),
                  entry.details ?? '',
                  entry.ip_address ?? '',
                ]);
                downloadCsv(
                  datedFilename('audit-log'),
                  toCsv(
                    [
                      tr('เวลา', 'Time'),
                      tr('กิจกรรม', 'Activity'),
                      tr('ผู้ใช้', 'User'),
                      tr('รายละเอียด', 'Details'),
                      'IP',
                    ],
                    rows,
                  ),
                );
              }}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] disabled:opacity-40"
              title={tr('ส่งออกรายการในหน้านี้', 'Export the items on this page')}
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

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="ตั้งแต่วันที่"
              className="w-full rounded-apple-widget border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)] sm:w-40"
            />
            <span className="text-[12px] text-[var(--ink-tertiary)]">ถึง</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="ถึงวันที่"
              className="w-full rounded-apple-widget border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)] sm:w-40"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]"
              >
                ล้างวันที่
              </button>
            )}
          </div>
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
                className="flex flex-col gap-2 rounded-apple-widget bg-[var(--surface-subtle)] p-3.5 sm:flex-row sm:items-center sm:justify-between"
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
                  </div>
                  {entry.details && (
                    <p className="mt-1 break-words text-[13px] leading-relaxed text-[var(--ink-muted)]">
                      {entry.details}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-left text-[12px] text-[var(--ink-tertiary)] sm:text-right">
                  <div className="tabular-nums">{formatDate(entry.created_at)}</div>
                  {entry.ip_address && <div className="tabular-nums">{entry.ip_address}</div>}
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
