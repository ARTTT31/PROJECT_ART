/**
 * Notification history fallback: the list is paged from the API and rendered
 * nothing at all while the first page was in flight.
 */
export default function NotificationsLoading() {
  return (
    <div className="space-y-5" aria-label="กำลังโหลดประวัติการแจ้งเตือน" aria-busy="true">
      <div className="flex animate-pulse items-center justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-full bg-[var(--surface-chip)]" />
          <div className="h-3 w-40 rounded-full bg-[var(--surface-chip-2)]" />
        </div>
        <div className="h-9 w-28 rounded-full bg-[var(--surface-chip)]" />
      </div>

      <div className="animate-pulse space-y-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="flex gap-3 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4"
          >
            <div className="h-9 w-9 shrink-0 rounded-apple-md bg-[var(--surface-chip)]" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 rounded-full bg-[var(--surface-chip)]" />
                <div className="h-3 w-16 rounded-full bg-[var(--surface-chip-2)]" />
              </div>
              <div className="h-3 w-3/4 rounded-full bg-[var(--surface-chip)]" />
              <div className="h-3 w-1/2 rounded-full bg-[var(--surface-chip-2)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
