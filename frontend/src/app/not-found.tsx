'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Home, LogIn, SearchX, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

export default function NotFound() {
  const { tr } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-[100dvh] text-slate-950" style={{ background: 'var(--art-page-bg)' }}>
      <a href="#main-content" className="skip-link">
        {tr('ข้ามไปยังเนื้อหาหลัก', 'Skip to main content')}
      </a>

      <div id="main-content" className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
        <section
          className={`w-full max-w-5xl overflow-hidden rounded-[var(--art-radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] shadow-glass transition-all duration-300 ease-out lg:grid lg:grid-cols-[0.92fr_1.08fr] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          role="alert"
          aria-live="polite"
        >
          {/* Left: Visual Panel */}
          <div className="relative min-h-[320px] overflow-hidden bg-[var(--accent-hover)] p-8 text-white sm:p-10">
            <div className="relative flex h-full min-h-[260px] flex-col justify-between">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-apple-md border border-white/24 bg-[var(--glass-20)]">
                <SearchX size={32} aria-hidden="true" />
              </div>
              <div>
                <p
                  className="text-[clamp(4rem,10vw,6rem)] font-semibold leading-none tracking-normal"
                  aria-label="404"
                >
                  404
                </p>
                <p className="mt-4 max-w-sm text-xl font-semibold leading-8 text-white/86">
                  {tr('ไม่พบหน้าที่คุณต้องการ', 'We could not find that page')}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Content Panel */}
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="text-sm font-bold text-sky-700">ART Workspace</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-normal text-slate-950">
              {tr('ลิงก์นี้อาจถูกย้าย หรือลบออกแล้ว', 'This link may have moved or been deleted')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              {tr(
                'กลับไปยังหน้าหลักของระบบ หรือเข้าสู่ระบบอีกครั้งเพื่อไปยังแดชบอร์ดของคุณ',
                'Go back to the home page, or sign in again to reach your dashboard.',
              )}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="art-primary-button inline-flex items-center justify-center gap-2 !rounded-apple-lg"
              >
                <Home size={18} aria-hidden="true" />
                {tr('กลับหน้า Dashboard', 'Back to dashboard')}
              </Link>
              <Link
                href="/login"
                className="art-soft-button inline-flex items-center justify-center gap-2 !rounded-apple-lg"
              >
                <LogIn size={18} aria-hidden="true" />
                {tr('ไปหน้า Login', 'Go to login')}
              </Link>
            </div>

            <button
              onClick={() => typeof window !== 'undefined' && window.history.back()}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {tr('กลับหน้าที่แล้ว', 'Go back')}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
