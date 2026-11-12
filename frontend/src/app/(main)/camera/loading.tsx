'use client';

import { useI18n } from '@/lib/i18n/I18nProvider';

export default function CameraLoading() {
  const { tr } = useI18n();
  return (
    <div
      className="space-y-5"
      aria-label={tr('กำลังโหลดหน้ากล้องวงจรปิด', 'Loading the CCTV page')}
      aria-busy="true"
    >
      <div className="flex min-h-16 animate-pulse items-center justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div className="h-6 w-40 rounded-full bg-[var(--surface-chip)]" />
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-full bg-[var(--surface-chip)]" />
          <div className="h-10 w-32 rounded-full bg-[var(--surface-chip)]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="aspect-video animate-pulse rounded-apple-lg bg-slate-800 lg:col-span-2" />
        <div className="animate-pulse rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="mb-5 h-5 w-40 rounded-full bg-[var(--surface-chip)]" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-apple-widget bg-[var(--surface-grouped)] p-3">
                <div className="h-9 w-9 rounded-apple-md bg-[var(--surface-chip)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded-full bg-[var(--surface-chip)]" />
                  <div className="h-3 w-20 rounded-full bg-[var(--surface-chip-2)]" />
                </div>
                <div className="h-5 w-12 rounded-full bg-[var(--surface-chip)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
