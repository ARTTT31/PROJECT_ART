export default function UserManagementSkeleton() {
  return (
    <div className="w-full">
      <div className="w-full space-y-4 animate-pulse py-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="h-10 w-64 rounded-full bg-[var(--surface-subtle)] ring-1 ring-[var(--hairline)]" />
            <div className="h-10 w-28 rounded-full bg-[var(--surface-subtle)] ring-1 ring-[var(--hairline)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-28 rounded-full bg-[var(--surface-subtle)] ring-1 ring-[var(--hairline)]" />
            <div className="h-10 w-28 rounded-full bg-[var(--accent-soft)]" />
          </div>
        </div>
        <div className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)]">
          <div className="h-12 border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)]" />
          <div className="divide-y divide-[var(--hairline-soft)] p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between pt-2">
                <div className="space-y-1.5">
                  <div className="h-4 w-36 rounded-[11px] bg-[var(--surface-chip)]" />
                  <div className="h-3 w-48 rounded-[11px] bg-[var(--surface-subtle)]" />
                </div>
                <div className="h-6 w-16 rounded-full bg-[var(--surface-chip)]" />
                <div className="h-6 w-14 rounded-full bg-[var(--surface-chip)]" />
                <div className="h-8 w-20 rounded-full bg-[var(--surface-subtle)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
