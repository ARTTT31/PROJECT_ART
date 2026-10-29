export default function ProfileLoading() {
  return (
    <div className="space-y-5 pb-12" aria-label="กำลังโหลดหน้าโปรไฟล์" aria-busy="true">
      <div className="h-28 animate-pulse rounded-[18px] border border-black/[0.06] bg-white" />
      <div className="h-14 animate-pulse rounded-[18px] bg-[#eaebee]" />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="min-h-[330px] animate-pulse rounded-[18px] border border-black/[0.06] bg-white p-6"
          >
            <div className="mb-6 h-5 w-40 rounded-full bg-[#e5e5ea]" />
            <div className="space-y-4">
              <div className="h-11 rounded-xl bg-[#f2f2f7]" />
              <div className="h-11 rounded-xl bg-[#f2f2f7]" />
              <div className="h-11 rounded-xl bg-[#f2f2f7]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
