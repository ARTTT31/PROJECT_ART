/**
 * Admin page fallback.
 *
 * Without it the route painted an empty frame while the user list loaded, which
 * read as "this page is broken" rather than "still fetching". Same skeleton
 * shapes as the real page: header, stat tiles, then the table.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-label="กำลังโหลดหน้าจัดการผู้ใช้" aria-busy="true">
      <div className="flex animate-pulse items-center justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-full bg-[var(--surface-chip)]" />
          <div className="h-3 w-64 rounded-full bg-[var(--surface-chip-2)]" />
        </div>
        <div className="h-10 w-32 rounded-full bg-[var(--surface-chip)]" />
      </div>

      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div
            key={tile}
            className="rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4"
          >
            <div className="h-3 w-20 rounded-full bg-[var(--surface-chip)]" />
            <div className="mt-3 h-6 w-14 rounded-full bg-[var(--surface-chip-2)]" />
          </div>
        ))}
      </div>

      <div className="animate-pulse rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <div className="mb-4 h-5 w-40 rounded-full bg-[var(--surface-chip)]" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex items-center gap-3 rounded-apple-widget bg-[var(--surface-grouped)] p-3"
            >
              <div className="h-9 w-9 rounded-full bg-[var(--surface-chip)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 rounded-full bg-[var(--surface-chip)]" />
                <div className="h-3 w-24 rounded-full bg-[var(--surface-chip-2)]" />
              </div>
              <div className="h-6 w-20 rounded-full bg-[var(--surface-chip)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
