'use client';

import { ArrowRight, Check, Clock, Loader2 } from 'lucide-react';

export default function PendingRequestsBanner({
  count,
  bulkApproving,
  onBulkApprove,
  onFilterPending,
}: {
  count: number;
  bulkApproving: boolean;
  onBulkApprove: () => void;
  onFilterPending: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-apple-lg bg-[var(--warning-soft)] border border-[var(--warning-soft)] text-[var(--ink)]">
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-apple-widget bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning-ink)] shrink-0 mt-0.5 sm:mt-0">
          <Clock size={18} />
        </span>
        <div>
          <div className="font-bold text-[14px] text-[var(--ink)] flex items-center gap-2">
            <span>มีคำขอสมัครสมาชิกใหม่ {count} รายการในหน้านี้ รอการอนุมัติ</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--warning-soft)] text-[var(--warning-ink)] ring-1 ring-[var(--warning-soft)]">
              รออนุมัติ
            </span>
          </div>
          <p className="text-[13px] text-[var(--ink-secondary)] mt-0.5">
            คุณสามารถกดอนุมัติได้ทันทีที่ตารางด้านล่าง หรือคลิกเพื่อกรองดูเฉพาะคำขอทั้งหมด
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={bulkApproving || count === 0}
          onClick={onBulkApprove}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--success-soft)] px-4 py-2 text-[13px] font-bold text-[var(--success-ink)] ring-1 ring-[var(--success-soft)] transition-all hover:bg-[color-mix(in_srgb,var(--success)_22%,transparent)] active:scale-[0.98] disabled:opacity-50"
        >
          {bulkApproving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Check size={14} aria-hidden="true" />
          )}
          อนุมัติทั้งหมด ({count})
        </button>
        <button
          type="button"
          onClick={onFilterPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--warning-soft)] ring-1 ring-[var(--warning-soft)] hover:bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] active:scale-[0.98] text-[var(--warning-ink)] text-[13px] font-bold transition-all shrink-0 self-stretch sm:self-auto justify-center"
        >
          <span>กรองดูเฉพาะคำขอรออนุมัติ</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
