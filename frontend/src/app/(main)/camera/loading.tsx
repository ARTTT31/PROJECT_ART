export default function CameraLoading() {
  return (
    <div className="space-y-5" aria-label="กำลังโหลดหน้ากล้องวงจรปิด" aria-busy="true">
      <div className="flex min-h-16 animate-pulse items-center justify-between gap-4 border-b border-black/[0.06] pb-5">
        <div className="h-6 w-40 rounded-full bg-[#e5e5ea]" />
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-full bg-[#e5e5ea]" />
          <div className="h-10 w-32 rounded-full bg-[#e5e5ea]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="aspect-video animate-pulse rounded-2xl bg-slate-800 lg:col-span-2" />
        <div className="animate-pulse rounded-2xl border border-black/[0.06] bg-white p-5">
          <div className="mb-5 h-5 w-40 rounded-full bg-[#e5e5ea]" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] p-3">
                <div className="h-9 w-9 rounded-[10px] bg-[#e5e5ea]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded-full bg-[#e5e5ea]" />
                  <div className="h-3 w-20 rounded-full bg-[#ececf0]" />
                </div>
                <div className="h-5 w-12 rounded-full bg-[#e5e5ea]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
