'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js route-level error boundary.
 * Catches errors that bubble up from any page and shows a full-page fallback.
 * This file must be a Client Component.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { tr } = useI18n();
  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center p-6"
      style={{ background: 'var(--art-page-bg)' }}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--art-radius-xl)] border border-white/30 bg-[var(--glass-80)] backdrop-blur-[24px] shadow-glass-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200/50 bg-red-50/50 px-6 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-apple-widget bg-red-100 text-red-600">
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {tr('เกิดข้อผิดพลาด', 'Something went wrong')}
            </h1>
            <p className="text-sm text-slate-500">
              {tr('ระบบไม่สามารถโหลดหน้านี้ได้', 'This page could not be loaded')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            {tr(
              'เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างการโหลดหน้าเพจ คุณสามารถลองโหลดใหม่ หรือกลับไปยังหน้าหลัก',
              'An unexpected error occurred while loading this page. You can reload, or go back to the home page.',
            )}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-apple-md bg-slate-100 p-3 text-xs text-red-700">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-slate-200/50 px-6 py-4">
          <button
            onClick={reset}
            className="art-primary-button inline-flex items-center gap-2 !rounded-apple-widget text-sm"
          >
            <RotateCcw size={16} aria-hidden="true" />
            {tr('ลองใหม่', 'Try again')}
          </button>
          <Link
            href="/dashboard"
            className="art-soft-button inline-flex items-center gap-2 !rounded-apple-widget text-sm"
          >
            <Home size={16} aria-hidden="true" />
            {tr('กลับหน้าหลัก', 'Back to home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
