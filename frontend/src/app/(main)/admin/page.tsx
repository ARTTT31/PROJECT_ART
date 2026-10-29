'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  FileText,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { RegistrationPolicyCard } from '@/components/Admin/RegistrationPolicyCard';
import { SystemHealthCard } from '@/components/Admin/SystemHealthCard';
import UserManagement from '@/components/Admin/UserManagement';

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
  const router = useRouter();
  const isClient = status !== 'loading';
  const isAdmin = user?.role === 'admin';

  const [pending, setPending] = useState<Stat>(EMPTY_STAT);
  const [events, setEvents] = useState<Stat>(EMPTY_STAT);

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
    if (!isAdmin) return;
    void loadStats();
  }, [isAdmin, loadStats]);

  if (!isClient || (user && !isAdmin)) {
    return (
      <div className="flex min-h-[480px] items-center justify-center" role="status">
        <Loader2 size={22} className="animate-spin text-[#86868b]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.05] bg-[#fafafc] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#5856d6]/10 text-[#4b49bd] ring-1 ring-[#5856d6]/15">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-bold tracking-tight text-[#1d1d1f]">
                ผู้ดูแลระบบ
              </h1>
              <p className="mt-0.5 text-[12px] leading-snug text-[#6e6e73]">
                คำขอสมัคร สิทธิ์การใช้งาน และประวัติกิจกรรมของทั้ง workspace
              </p>
            </div>
          </div>
          <Link
            href="/profile?tab=preferences"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#1d1d1f] shadow-xs ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] active:scale-95"
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            จัดการเมนูหลัก
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <Link
            href="/audit"
            className="group flex items-center justify-between gap-3 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5 transition-all duration-150 hover:-translate-y-px hover:border-[#0066cc]/25 hover:shadow-[0_8px_18px_-12px_rgba(0,0,0,0.4)]"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
                <FileText size={13} aria-hidden="true" />
                บันทึกกิจกรรม
              </p>
              <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-[#1d1d1f]">
                {events.loading ? '—' : (events.value ?? '—')}
              </p>
              <p className="mt-1 text-[11px] text-[#a1a1a6]">รายการที่บันทึกไว้ทั้งหมด</p>
            </div>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="shrink-0 text-[#c7c7cc] transition-all group-hover:translate-x-0.5 group-hover:text-[#0066cc]"
            />
          </Link>

          <Link
            href="#approval-queue"
            className="group flex items-center justify-between gap-3 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5 transition-all duration-150 hover:-translate-y-px hover:border-[#0066cc]/25 hover:shadow-[0_8px_18px_-12px_rgba(0,0,0,0.4)]"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
                <UserPlus size={13} aria-hidden="true" />
                รออนุมัติ
              </p>
              <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-[#1d1d1f]">
                {pending.loading ? '—' : (pending.value ?? '—')}
              </p>
              <p className="mt-1 text-[11px] text-[#a1a1a6]">คำขอสมัครสมาชิกที่รอการตัดสินใจ</p>
            </div>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="shrink-0 text-[#c7c7cc] transition-all group-hover:translate-x-0.5 group-hover:text-[#0066cc]"
            />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 border-t border-black/[0.05] px-5 py-2.5 text-[10.5px] text-[#a1a1a6] sm:px-6">
          <Clock3 size={11} aria-hidden="true" />
          ข้อมูลอัปเดตเมื่อเปิดหน้านี้ — กดรีเฟรชเพื่อดูใหม่
        </div>
      </section>

      {/* ── System health ────────────────────────────────────────── */}
      <SystemHealthCard />

      {/* ── Sign-up policy ───────────────────────────────────────── */}
      <RegistrationPolicyCard />

      {/* ── People ───────────────────────────────────────────────── */}
      <div id="approval-queue" className="scroll-mt-4">
        <UserManagement />
      </div>
    </div>
  );
}
