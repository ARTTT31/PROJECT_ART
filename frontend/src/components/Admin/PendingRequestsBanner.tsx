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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-apple-lg bg-amber-500/[0.08] border border-amber-500/25 text-[var(--ink)]">
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-apple-widget bg-amber-500/15 text-amber-700 shrink-0 mt-0.5 sm:mt-0">
          <Clock size={18} />
        </span>
        <div>
          <div className="font-bold text-[14px] text-amber-950 flex items-center gap-2">
            <span>มีคำขอสมัครสมาชิกใหม่ {count} รายการในหน้านี้ รอการอนุมัติ</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
              รออนุมัติ
            </span>
          </div>
          <p className="text-[13px] text-amber-800/90 mt-0.5">
            คุณสามารถกดอนุมัติได้ทันทีที่ตารางด้านล่าง หรือคลิกเพื่อกรองดูเฉพาะคำขอทั้งหมด
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={bulkApproving || count === 0}
          onClick={onBulkApprove}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
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
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-[13px] font-bold shadow-xs transition-all shrink-0 self-stretch sm:self-auto justify-center"
        >
          <span>กรองดูเฉพาะคำขอรออนุมัติ</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
