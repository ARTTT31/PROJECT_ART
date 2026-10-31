'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { canAccessPage } from '@/utils/accessiblePages';

/**
 * Client-side half of the page-access check.
 *
 * The backend refuses the APIs behind a page the account was not granted, and
 * this guard makes the *reason* visible: opening the URL of a page you cannot
 * use shows an empty state that says so and offers a way back, instead of a
 * silent redirect or a wall of failed requests. Hiding a menu entry is not
 * authorization, and an empty screen is not an explanation.
 */
export default function PageAccessGuard({
  page,
  children,
}: {
  page: string;
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-500"
          aria-label="กำลังโหลด"
        />
      </div>
    );
  }

  if (!canAccessPage(user, page)) {
    return (
      <section
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] px-6 py-10 text-center"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--ink-muted)]"
        >
          <Lock size={22} />
        </span>
        <h2 className="text-[17px] font-bold text-[var(--ink)]">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
          บัญชีของคุณไม่ได้รับสิทธิ์ในหน้านี้ กรุณาติดต่อผู้ดูแลระบบหากต้องการเข้าใช้งาน
        </p>
        <Link
          href="/dashboard"
          className="mt-1 inline-flex min-h-[44px] items-center rounded-full bg-[var(--accent)] px-6 text-[13.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
        >
          กลับหน้าหลัก
        </Link>
      </section>
    );
  }

  return children;
}
