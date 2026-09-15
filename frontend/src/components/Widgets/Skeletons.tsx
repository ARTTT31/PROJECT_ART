'use client'

export function WeatherSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[24px] bg-white p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-[12px] bg-slate-100 animate-pulse" />
            <div className="space-y-2 py-1">
              <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-3 w-32 rounded-full bg-slate-50 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-16 rounded-full bg-slate-100 animate-pulse" />
        </div>
        
        <div className="flex items-end justify-between mt-6">
          <div className="space-y-2">
            <div className="h-12 w-28 rounded-lg bg-slate-100 animate-pulse" />
            <div className="h-4 w-20 rounded-full bg-slate-50 animate-pulse" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-6 w-24 rounded-full bg-slate-100 animate-pulse ml-auto" />
            <div className="h-3 w-32 rounded-full bg-slate-50 animate-pulse ml-auto" />
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex justify-between gap-2 border-t border-black/[0.04] pt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-3 w-8 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-6 w-6 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-4 w-8 rounded-full bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HolidaySkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[24px] bg-white p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-[12px] bg-slate-100 animate-pulse" />
            <div className="space-y-2 py-1">
              <div className="h-4 w-32 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-3 w-40 rounded-full bg-slate-50 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-16 rounded-full bg-slate-100 animate-pulse" />
        </div>

        <div className="mt-4 rounded-[18px] bg-slate-50 p-4 border border-slate-100 animate-pulse">
          <div className="h-3 w-24 rounded-full bg-slate-200 mb-2" />
          <div className="h-5 w-48 rounded-full bg-slate-200 mb-2" />
          <div className="h-3 w-full max-w-[200px] rounded-full bg-slate-200" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-[14px] bg-white p-3 ring-1 ring-slate-100 animate-pulse">
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
  )
}

export function OilPriceSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[24px] bg-white p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] bg-slate-100 animate-pulse" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-3 w-32 rounded-full bg-slate-50 animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full bg-slate-100 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[16px] bg-slate-50 p-3 ring-1 ring-slate-100 animate-pulse">
            <div className="h-3 w-16 rounded-full bg-slate-200 mb-2" />
            <div className="h-6 w-20 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function QRCodeSkeleton() {
  return (
    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[24px] bg-white p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[12px] bg-slate-100 animate-pulse" />
          <div className="space-y-2 py-1">
            <div className="h-4 w-32 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-3 w-40 rounded-full bg-slate-50 animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-16 rounded-full bg-slate-100 animate-pulse" />
      </div>

      <div className="flex flex-col items-center justify-center p-4">
        <div className="h-40 w-40 rounded-2xl bg-slate-100 animate-pulse mb-4" />
        <div className="h-10 w-full max-w-[300px] rounded-xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  )
}
