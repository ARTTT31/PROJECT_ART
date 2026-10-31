export default function ProfileLoading() {
  return (
    <div className="space-y-5 pb-12" aria-label="กำลังโหลดหน้าโปรไฟล์" aria-busy="true">
      <div className="h-28 animate-pulse rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)]" />
      <div className="h-14 animate-pulse rounded-[18px] bg-[var(--surface-chip)]" />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="min-h-[330px] animate-pulse rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-6"
          >
            <div className="mb-6 h-5 w-40 rounded-full bg-[var(--surface-chip)]" />
            <div className="space-y-4">
              <div className="h-11 rounded-xl bg-[var(--surface-grouped-2)]" />
              <div className="h-11 rounded-xl bg-[var(--surface-grouped-2)]" />
              <div className="h-11 rounded-xl bg-[var(--surface-grouped-2)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
