'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, BarChart3, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  ALL_PERIOD,
  type FinanceEntry,
  filterByPeriod,
  groupByDay,
  monthOptions,
  monthlySeries,
  summarize,
} from '@/lib/finance/summary';

const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

/** Compact label for chart tooltips: "12,500" grows unreadable in a bar. */
const compact = new Intl.NumberFormat('th-TH', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Summary view for the finance widget: one period at a time (a month, or every
 * entry), plus a six-month trend so a month can be read in context.
 *
 * It is a dialog rather than a page because the entries already live behind
 * `dashboard` access — a new sidebar page would need its own entry in
 * `accessible_pages` and would be invisible to every account that predates it.
 */
export default function FinanceSummaryDialog({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FinanceEntry[];
}) {
  const options = useMemo(() => monthOptions(entries), [entries]);
  const [period, setPeriod] = useState<string>(options[0]?.key ?? ALL_PERIOD);

  // Reopening should land on the current month, not on whatever the user
  // browsed to last time.
  useEffect(() => {
    if (open) setPeriod(monthOptions(entries)[0]?.key ?? ALL_PERIOD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const periodEntries = useMemo(() => filterByPeriod(entries, period), [entries, period]);
  const totals = useMemo(() => summarize(periodEntries), [periodEntries]);
  const days = useMemo(() => groupByDay(periodEntries), [periodEntries]);
  const series = useMemo(() => monthlySeries(entries, 6), [entries]);

  const peak = Math.max(1, ...series.flatMap((point) => [point.income, point.expense]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#34c759]/10 text-[#248a3d]">
              <BarChart3 size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[17px] text-[#1d1d1f]">
                ภาพรวมรายรับ – รายจ่าย
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] text-[#86868b]">
                สรุปตามเดือน และเทียบกับ 6 เดือนล่าสุด
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="finance-period"
              className="text-[12px] font-semibold text-[#6e6e73]"
            >
              ช่วงเวลา
            </label>
            <select
              id="finance-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1d1d1f] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20"
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
              <option value={ALL_PERIOD}>ทุกเดือน (สะสม)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-[14px] bg-[#34c759]/10 px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[#248a3d]">รายรับ</span>
              <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[#1d1d1f]">
                {money.format(totals.income)}
              </span>
            </div>
            <div className="rounded-[14px] bg-[#ff3b30]/10 px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[#b42318]">รายจ่าย</span>
              <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[#1d1d1f]">
                {money.format(totals.expense)}
              </span>
            </div>
            <div className="rounded-[14px] bg-[#f5f5f7] px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[#6e6e73]">คงเหลือ</span>
              <span
                className={`mt-0.5 block tabular-nums text-[15px] font-extrabold ${
                  totals.balance < 0 ? 'text-[#b42318]' : 'text-[#1d1d1f]'
                }`}
              >
                {money.format(totals.balance)}
              </span>
            </div>
            <div className="rounded-[14px] bg-[#f5f5f7] px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[#6e6e73]">รายการ</span>
              <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[#1d1d1f]">
                {totals.count}
              </span>
            </div>
          </div>

          {/* Trend — always the last six months, independent of the picker. */}
          <div className="rounded-[14px] border border-black/[0.06] bg-white px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-[#6e6e73]">6 เดือนล่าสุด</span>
              <div className="flex items-center gap-3 text-[10.5px] text-[#6e6e73]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#34c759]" aria-hidden="true" />
                  รายรับ
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#ff3b30]" aria-hidden="true" />
                  รายจ่าย
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between gap-1.5">
              {series.map((point) => (
                <div
                  key={point.key}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  role="img"
                  aria-label={`${point.label} รายรับ ${money.format(point.income)} รายจ่าย ${money.format(point.expense)}`}
                  title={`${point.label}: รับ ${compact.format(point.income)} / จ่าย ${compact.format(point.expense)}`}
                >
                  <div className="flex h-[64px] w-full items-end justify-center gap-1">
                    <span
                      className="w-2.5 rounded-t-[3px] bg-[#34c759] transition-all duration-300"
                      style={{
                        height: `${Math.max(point.income > 0 ? 4 : 0, (point.income / peak) * 100)}%`,
                      }}
                    />
                    <span
                      className="w-2.5 rounded-t-[3px] bg-[#ff3b30] transition-all duration-300"
                      style={{
                        height: `${Math.max(point.expense > 0 ? 4 : 0, (point.expense / peak) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="truncate text-[10px] text-[#86868b]">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day-by-day list for the selected period. */}
          <div className="space-y-2">
            {days.length === 0 ? (
              <div className="flex min-h-[92px] flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] bg-[#f8f8fa] px-3 py-4 text-center text-[12.5px] text-[#86868b]">
                <Wallet size={18} className="mb-1.5 text-[#a1a1a6]" aria-hidden="true" />
                ยังไม่มีรายการในช่วงนี้
              </div>
            ) : (
              days.map((day) => (
                <div key={day.date} className="rounded-[14px] bg-[#f8f8fa] px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2 pb-1.5">
                    <span className="text-[11.5px] font-bold text-[#6e6e73]">{day.label}</span>
                    <span className="tabular-nums text-[11px] font-semibold text-[#86868b]">
                      รับ {money.format(day.income)} · จ่าย {money.format(day.expense)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {day.entries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2.5">
                        {entry.type === 'income' ? (
                          <ArrowUpCircle
                            size={15}
                            className="shrink-0 text-[#248a3d]"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDownCircle
                            size={15}
                            className="shrink-0 text-[#b42318]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#1d1d1f]">
                          {entry.label || (entry.type === 'income' ? 'รายรับ' : 'รายจ่าย')}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums text-[12.5px] font-bold ${
                            entry.type === 'income' ? 'text-[#248a3d]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          {entry.type === 'income' ? '+' : '−'}
                          {money.format(entry.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
