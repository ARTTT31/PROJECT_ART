'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RotateCw,
  Search,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

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

// Thai labels for the actions the backend actually writes. Anything else is
// shown as its raw key so a new action is still visible before it is translated.
const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'เข้าสู่ระบบ',
  LOGIN_FAILED: 'เข้าสู่ระบบไม่สำเร็จ',
  LOGOUT: 'ออกจากระบบ',
  USER_REGISTER: 'สมัครสมาชิก',
  USER_REGISTER_PENDING: 'สมัครสมาชิก (รออนุมัติ)',
  USER_REGISTER_RESUBMIT: 'ส่งคำขอสมัครใหม่',
  USER_REGISTER_BLOCKED: 'ถูกปฏิเสธการสมัคร',
  USER_REGISTER_DUPLICATE: 'สมัครซ้ำ',
  PASSWORD_RESET_REQUESTED: 'ขอลืมรหัสผ่าน',
  PASSWORD_RESET_COMPLETED: 'ตั้งรหัสผ่านใหม่',
  PASSWORD_CHANGE: 'เปลี่ยนรหัสผ่าน',
  EMAIL_VERIFIED: 'ยืนยันอีเมล',
  EMAIL_VERIFICATION_RESENT: 'ส่งอีเมลยืนยันอีกครั้ง',
  PROFILE_UPDATE: 'แก้ไขโปรไฟล์',
  AVATAR_UPLOAD: 'เปลี่ยนรูปโปรไฟล์',
  USER_SELF_DELETE: 'ลบบัญชีตัวเอง',
  UPDATE_BRANDING: 'แก้ไขแบรนด์ระบบ',
  UPLOAD_BRAND_LOGO: 'เปลี่ยนโลโก้ระบบ',
  UPLOAD_WORKSPACE_LOGO: 'เปลี่ยนโลโก้ทีม',
  ADMIN_USER_CREATE: 'แอดมินสร้างผู้ใช้',
  ADMIN_USER_CREATE_HYBRID: 'แอดมินสร้างผู้ใช้ (กำหนดเอง)',
  ADMIN_USER_UPDATE: 'แอดมินแก้ไขผู้ใช้',
  ADMIN_USER_DELETE: 'แอดมินลบผู้ใช้',
  ADMIN_USER_RESTORE: 'แอดมินกู้คืนผู้ใช้',
  ADMIN_USER_APPROVE: 'อนุมัติสมาชิก',
  ADMIN_USER_REJECT: 'ปฏิเสธสมาชิก',
};

const ACTION_OPTIONS = Object.keys(ACTION_LABELS);

function actionTone(action: string) {
  if (action.includes('FAIL') || action.includes('BLOCK') || action.includes('DELETE')) {
    return 'bg-[#ff3b30]/10 text-[#b42318]';
  }
  if (action.includes('ADMIN') || action.includes('BRANDING')) {
    return 'bg-[#5856d6]/10 text-[#4b49bd]';
  }
  if (action.startsWith('LOGIN') || action === 'LOGOUT') {
    return 'bg-[#0066cc]/10 text-[#0055aa]';
  }
  return 'bg-[#34c759]/10 text-[#248a3d]';
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
  });
}

export default function AuditPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const isClient = status !== 'loading';

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  }, [action, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (action) params.set('action', action);
      if (debouncedSearch) params.set('q', debouncedSearch);

      const res = await fetchWithAuth(`/api/v1/audit/paginated?${params.toString()}`);
      if (!res.ok) {
        throw new Error(
          res.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ดูบันทึกกิจกรรม' : `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as PaginatedResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
      setHasNext(Boolean(data.hasNext));
      setHasPrev(Boolean(data.hasPrev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดบันทึกกิจกรรมไม่สำเร็จ');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, action, debouncedSearch]);

  useEffect(() => {
    if (!isClient || user?.role !== 'admin') return;
    void load();
  }, [isClient, user?.role, load]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return 'ไม่มีรายการ';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = start + items.length - 1;
    return `แสดง ${start}–${end} จาก ${total} รายการ`;
  }, [page, items.length, total]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#0066cc]/10 text-[#0066cc]">
              <FileText size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight text-[#1d1d1f]">บันทึกกิจกรรม</h2>
              <p className="mt-0.5 text-[12.5px] text-[#6e6e73]">
                ประวัติการเข้าสู่ระบบ การแก้ไขข้อมูล และการจัดการบัญชี — เห็นเฉพาะผู้ดูแลระบบ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-[#f5f5f7] px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#e5e5ea] sm:self-auto"
          >
            <RotateCw size={14} aria-hidden="true" /> รีเฟรช
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหารายละเอียด ชื่อ หรืออีเมล"
              aria-label="ค้นหาบันทึกกิจกรรม"
              className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
            />
          </div>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            aria-label="กรองตามประเภทกิจกรรม"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-[#1d1d1f] sm:w-60"
          >
            <option value="">ทุกประเภทกิจกรรม</option>
            {ACTION_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {ACTION_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-[18px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-5">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[240px] items-center justify-center"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[#0066cc]" aria-hidden="true" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[14px] border border-[#ff3b30]/15 bg-[#ff3b30]/[0.06] p-4 text-[13px] text-[#b42318]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] bg-[#f8f8fa] px-4 text-center text-[13px] text-[#86868b]">
            <FileText size={22} className="mb-2 text-[#a1a1a6]" aria-hidden="true" />
            <span>ไม่พบบันทึกกิจกรรมที่ตรงกับเงื่อนไข</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-[14px] bg-[#f8f8fa] p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${actionTone(entry.action)}`}
                    >
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="text-[12px] font-semibold text-[#1d1d1f]">
                      {entry.user?.name || entry.user?.email || 'ระบบ'}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="mt-1 break-words text-[12.5px] leading-relaxed text-[#6e6e73]">
                      {entry.details}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-left text-[11.5px] text-[#86868b] sm:text-right">
                  <div className="tabular-nums">{formatDate(entry.created_at)}</div>
                  {entry.ip_address && <div className="tabular-nums">{entry.ip_address}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3 text-[12px] text-[#6e6e73]">
          <span>{rangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!hasPrev || loading}
              className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-3 py-1.5 font-semibold text-[#1d1d1f] transition-colors hover:bg-[#e5e5ea] disabled:opacity-40"
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
              className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-3 py-1.5 font-semibold text-[#1d1d1f] transition-colors hover:bg-[#e5e5ea] disabled:opacity-40"
            >
              ถัดไป <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
