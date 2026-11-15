export default function ShareTargetLoading() {
  return (
    <div
      className="mx-auto max-w-lg space-y-5 pb-12 pt-4"
      aria-label="กำลังโหลดหน้าบันทึกข้อมูล"
      aria-busy="true"
    >
      <div className="h-8 w-48 animate-pulse rounded-apple-md bg-[var(--surface-chip)]" />
      <div className="animate-pulse space-y-4 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded-full bg-[var(--surface-chip)]" />
          <div className="h-11 rounded-apple-md bg-[var(--surface-grouped)]" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 rounded-full bg-[var(--surface-chip)]" />
          <div className="h-24 rounded-apple-md bg-[var(--surface-grouped)]" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded-full bg-[var(--surface-chip)]" />
          <div className="h-11 rounded-apple-md bg-[var(--surface-grouped)]" />
        </div>
        <div className="pt-2">
          <div className="h-11 w-full rounded-apple-md bg-[var(--surface-chip)]" />
        </div>
      </div>
    </div>
  );
}
