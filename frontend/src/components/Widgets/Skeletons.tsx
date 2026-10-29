'use client';

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-5" aria-label="กำลังโหลดหน้าหลัก" aria-busy="true">
      <div className="flex min-h-[142px] animate-pulse flex-col justify-between gap-5 rounded-[18px] border border-black/[0.06] bg-white p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="space-y-3">
          <div className="h-8 w-64 max-w-full rounded-full bg-[#e5e5ea]" />
          <div className="h-4 w-48 rounded-full bg-[#f2f2f7]" />
        </div>
        <div className="h-10 w-36 rounded-full bg-[#f2f2f7]" />
      </div>
      <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-4 sm:gap-5 md:grid-cols-12">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className={`min-h-[300px] animate-pulse rounded-[18px] border border-black/[0.06] bg-white p-5 ${item === 2 ? 'col-span-full md:col-span-8' : 'col-span-full md:col-span-6'}`}
            style={{ animationDelay: `${item * 70}ms` }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-[12px] bg-[#f2f2f7]" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded-full bg-[#e5e5ea]" />
                <div className="h-3 w-40 rounded-full bg-[#f2f2f7]" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-12 rounded-xl bg-[#f5f5f7]" />
              <div className="h-12 rounded-xl bg-[#f5f5f7]" />
              <div className="h-12 rounded-xl bg-[#f5f5f7]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeatherSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
            <div className="space-y-2 py-1">
              <div className="h-4 w-24 rounded-full skeleton-shimmer" />
              <div className="h-3 w-32 rounded-full skeleton-shimmer" />
            </div>
          </div>
          <div className="h-8 w-16 rounded-full skeleton-shimmer" />
        </div>

        <div className="flex items-end justify-between mt-6">
          <div className="space-y-2">
            <div className="h-12 w-28 rounded-lg skeleton-shimmer" />
            <div className="h-4 w-20 rounded-full skeleton-shimmer" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-6 w-24 rounded-full skeleton-shimmer ml-auto" />
            <div className="h-3 w-32 rounded-full skeleton-shimmer ml-auto" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-between gap-2 border-t border-black/[0.04] pt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-3 w-8 rounded-full skeleton-shimmer" />
            <div className="h-6 w-6 rounded-full skeleton-shimmer" />
            <div className="h-4 w-8 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HolidaySkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
            <div className="space-y-2 py-1">
              <div className="h-4 w-32 rounded-full skeleton-shimmer" />
              <div className="h-3 w-40 rounded-full skeleton-shimmer" />
            </div>
          </div>
          <div className="h-8 w-16 rounded-full skeleton-shimmer" />
        </div>

        <div className="mt-4 rounded-[18px] bg-slate-50 p-4 border border-slate-100 skeleton-shimmer">
          <div className="h-3 w-24 rounded-full bg-slate-200 mb-2" />
          <div className="h-5 w-48 rounded-full bg-slate-200 mb-2" />
          <div className="h-3 w-full max-w-[200px] rounded-full bg-slate-200" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-[14px] bg-white p-3 ring-1 ring-slate-100 skeleton-shimmer"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-50" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded-full bg-slate-100" />
                <div className="h-3 w-20 rounded-full bg-slate-50" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OilPriceSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-24 rounded-full skeleton-shimmer" />
            <div className="h-3 w-32 rounded-full skeleton-shimmer" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-[16px] bg-slate-50 p-3 ring-1 ring-slate-100 skeleton-shimmer"
          >
            <div className="h-3 w-16 rounded-full bg-slate-200 mb-2" />
            <div className="h-6 w-20 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickNotesSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-40 rounded-full skeleton-shimmer" />
            <div className="h-3 w-28 rounded-full skeleton-shimmer" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
      </div>

      <div className="h-9 w-full rounded-xl skeleton-shimmer" />

      <div className="mt-3 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-full rounded-[14px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function ListWidgetSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-32 rounded-full skeleton-shimmer" />
            <div className="h-3 w-40 rounded-full skeleton-shimmer" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
      </div>

      <div className="h-9 w-full rounded-xl skeleton-shimmer" />

      <div className="mt-3 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-full rounded-[12px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function PriceCalcSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-28 rounded-full skeleton-shimmer" />
            <div className="h-3 w-40 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 rounded-xl skeleton-shimmer" />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-[18px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function MarketSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-36 rounded-full skeleton-shimmer" />
            <div className="h-3 w-44 rounded-full skeleton-shimmer" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-[18px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function QRCodeSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[18px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] skeleton-shimmer" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-32 rounded-full skeleton-shimmer" />
            <div className="h-3 w-40 rounded-full skeleton-shimmer" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
      </div>

      <div className="flex flex-col items-center justify-center p-4">
        <div className="h-40 w-40 rounded-2xl skeleton-shimmer mb-4" />
        <div className="h-10 w-full max-w-[300px] rounded-xl skeleton-shimmer" />
      </div>
    </div>
  );
}
