'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import ActiveSessionsCard from '@/components/Admin/ActiveSessionsCard';
import { RegistrationPolicyCard } from '@/components/Admin/RegistrationPolicyCard';
import PageAccessCard from '@/components/Admin/PageAccessCard';
import UserManagement from '@/components/Admin/UserManagement';
import { usePageHeading } from '@/components/ui/PageHeader';

interface Stat {
  value: number | null;
  loading: boolean;
}

const EMPTY_STAT: Stat = { value: null, loading: true };

/**
 * Admin console.
 *
 * Members' sidebar is for pages everyone visits; everything only an admin may
 * touch (who can sign up, who is allowed in, what happened) lives together here
 * so it is one obvious place instead of being scattered through the profile
 * tabs. The page itself is not the security boundary — every endpoint it calls
 * checks the admin role server-side.
 */
export default function AdminPage() {
  const { user, status } = useAuth();
  const headingRef = usePageHeading('จัดการระบบ');
  const router = useRouter();
  const isClient = status !== 'loading';
  const isAdmin = user?.role === 'admin';

  const [pending, setPending] = useState<Stat>(EMPTY_STAT);
  const [events, setEvents] = useState<Stat>(EMPTY_STAT);
  // /audit links here with `?sessions=<email>` after an entry is inspected. Read
  // it on the client (rather than useSearchParams) so this client page needs no
  // Suspense boundary for its static shell. `null` means "not read yet": the
  // device card waits for the value so its first request already has the filter.
  const [sessionsQuery, setSessionsQuery] = useState<string | null>(null);

  useEffect(() => {
    setSessionsQuery(new URLSearchParams(window.location.search).get('sessions')?.trim() ?? '');
  }, []);
  // Admin endpoints answer 403 while the account has no second factor; the
  // message is the backend's, so the page never invents its own rule.
  const [adminBlocked, setAdminBlocked] = useState('');
  const twoFactorEnabled = user?.two_factor_enabled === true;
  const twoFactorKnown = user?.two_factor_enabled !== undefined;
  // Every admin endpoint enforces 2FA. Gate the UI on the same flag so an
  // account that has not enabled it never fires the requests that would 403.
  const canUseAdmin = isAdmin && twoFactorEnabled && !adminBlocked;

  // A member who types the URL is sent back; the API would refuse anyway, but
  // an empty console would look like a broken page.
  useEffect(() => {
    if (isClient && user && !isAdmin) router.replace('/dashboard');
  }, [isClient, user, isAdmin, router]);

  const loadStats = useCallback(async () => {
    try {
      const pendingRes = await fetchWithAuth('/api/v1/users/pending?skip=0&limit=100');
      if (pendingRes.ok) {
        const headerTotal = Number.parseInt(pendingRes.headers.get('X-Total-Count') ?? '', 10);
        const body = (await pendingRes.json()) as unknown;
        const count = Number.isFinite(headerTotal)
          ? headerTotal
          : Array.isArray(body)
            ? body.length
            : 0;
        setPending({ value: count, loading: false });
      } else {
        if (pendingRes.status === 403) {
          const body = (await pendingRes.json().catch(() => null)) as {
            detail?: unknown;
          } | null;
          if (typeof body?.detail === 'string' && body.detail) {
            setAdminBlocked(body.detail);
          }
        }
        setPending({ value: null, loading: false });
      }
    } catch {
      setPending({ value: null, loading: false });
    }

    try {
      const auditRes = await fetchWithAuth('/api/v1/audit/paginated?page=1&size=1');
      if (auditRes.ok) {
        const body = (await auditRes.json()) as { total?: number };
        setEvents({ value: typeof body.total === 'number' ? body.total : null, loading: false });
      } else {
        setEvents({ value: null, loading: false });
      }
    } catch {
      setEvents({ value: null, loading: false });
    }
  }, []);

  useEffect(() => {
    if (!canUseAdmin) return;
    void loadStats();
  }, [canUseAdmin, loadStats]);

  if (!isClient || (user && !isAdmin) || (isAdmin && !twoFactorKnown)) {
    return (
      <div className="flex min-h-[480px] items-center justify-center" role="status">
        <Loader2 size={22} className="animate-spin text-[var(--ink-tertiary)]" aria-hidden="true" />
      </div>
    );
  }

  // An admin without a second factor (or whose session the backend still
  // refuses) sees the setup path only: no cards, and therefore no 403s.
  if (isAdmin && !canUseAdmin) {
    return (
      <div className="space-y-4">
        <section
          role="alert"
          className="flex items-start gap-3 rounded-apple-lg border border-[var(--hairline)] bg-[var(--warning-soft)] px-5 py-4"
        >
          <ShieldAlert
            size={18}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--warning-ink)]"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--ink)]">ต้องเปิด 2FA ก่อนใช้ส่วนผู้ดูแล</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
              {adminBlocked ||
                'บัญชีผู้ดูแลระบบต้องเปิดการยืนยันสองขั้นตอน (2FA) ก่อนใช้งานส่วนผู้ดูแล — เปิดได้ที่โปรไฟล์ → ตั้งค่าความปลอดภัย'}
            </p>
            <Link
              href="/profile"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-text)] hover:underline active:scale-[0.98]"
            >
              ไปที่โปรไฟล์เพื่อเปิด 2FA
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--info-soft)] text-[var(--info-ink)] ring-1 ring-[var(--info-soft)]">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1
                ref={headingRef}
                className="text-apple-title3 font-semibold text-[var(--ink)]"
              >
                จัดการระบบ
              </h1>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                คำขอสมัคร สิทธิ์การใช้งาน และประวัติกิจกรรมของทั้ง workspace
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <Link
            href="/audit"
            className="group flex items-center justify-between gap-3 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 transition-colors duration-150 hover:border-[var(--accent-border)]"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-muted)]">
                <FileText size={13} aria-hidden="true" />
                บันทึกกิจกรรม
              </p>
              <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-[var(--ink)]">
                {events.loading ? '—' : (events.value ?? '—')}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">รายการที่บันทึกไว้ทั้งหมด</p>
            </div>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="shrink-0 text-[var(--ink-divider)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent-text)]"
            />
          </Link>

          <Link
            href="#approval-queue"
            className="group flex items-center justify-between gap-3 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 transition-colors duration-150 hover:border-[var(--accent-border)]"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-muted)]">
                <UserPlus size={13} aria-hidden="true" />
                รออนุมัติ
              </p>
              <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-[var(--ink)]">
                {pending.loading ? '—' : (pending.value ?? '—')}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">คำขอสมัครสมาชิกที่รอการตัดสินใจ</p>
            </div>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="shrink-0 text-[var(--ink-divider)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent-text)]"
            />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 border-t border-[var(--hairline-soft)] px-5 py-2.5 text-[11px] text-[var(--ink-tertiary)] sm:px-6">
          <Clock3 size={11} aria-hidden="true" />
          ข้อมูลอัปเดตเมื่อเปิดหน้านี้ — กดรีเฟรชเพื่อดูใหม่
        </div>
      </section>

      {/* ── Who is signed in right now ───────────────────────────── */}
      {sessionsQuery !== null && (
        <div id="active-sessions" className="scroll-mt-4">
          <ActiveSessionsCard initialQuery={sessionsQuery} />
        </div>
      )}

      {/* ── Pages open for the whole workspace ───────────────────── */}
      <PageAccessCard />

      {/* ── Sign-up policy ───────────────────────────────────────── */}
      <RegistrationPolicyCard />

      {/* ── People ───────────────────────────────────────────────── */}
      <div id="approval-queue" className="scroll-mt-4">
        <UserManagement />
      </div>
    </div>
  );
}
