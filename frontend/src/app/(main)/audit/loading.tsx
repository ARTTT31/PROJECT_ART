/**
 * Audit log fallback: the page fetched three filters plus the first page of
 * rows, so the route sat blank long enough to look broken.
 */
export default function AuditLoading() {
  return (
    <div className="space-y-5" aria-label="กำลังโหลดบันทึกกิจกรรม" aria-busy="true">
      <div className="animate-pulse space-y-2 border-b border-[var(--hairline)] pb-5">
        <div className="h-6 w-40 rounded-full bg-[var(--surface-chip)]" />
        <div className="h-3 w-56 rounded-full bg-[var(--surface-chip-2)]" />
      </div>

      <div className="flex animate-pulse flex-wrap items-center gap-2">
        <div className="h-10 w-full rounded-apple-widget bg-[var(--surface-chip)] sm:w-64" />
        <div className="h-10 w-40 rounded-apple-widget bg-[var(--surface-chip)]" />
        <div className="h-10 w-36 rounded-apple-widget bg-[var(--surface-chip-2)]" />
      </div>

      <div className="animate-pulse space-y-2">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex flex-col gap-2 rounded-apple-widget bg-[var(--surface-subtle)] p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 rounded-full bg-[var(--surface-chip)]" />
                <div className="h-3 w-28 rounded-full bg-[var(--surface-chip-2)]" />
              </div>
              <div className="h-3 w-56 rounded-full bg-[var(--surface-chip)]" />
            </div>
            <div className="h-3 w-20 rounded-full bg-[var(--surface-chip-2)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
