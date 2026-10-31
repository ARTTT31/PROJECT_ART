'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, BarChart3, Download, Search, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  ALL_PERIOD,
  type EntryType,
  type FinanceEntry,
  categoryTotals,
  filterByPeriod,
  filterEntries,
  groupByDay,
  monthOptions,
  monthlySeries,
  summarize,
  toCsv,
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
  budget = null,
  onBudgetChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FinanceEntry[];
  budget?: number | null;
  onBudgetChange?: (value: number | null) => void;
}) {
  const options = useMemo(() => monthOptions(entries), [entries]);
  const [period, setPeriod] = useState<string>(options[0]?.key ?? ALL_PERIOD);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
  const [budgetDraft, setBudgetDraft] = useState('');

  // Reopening should land on the current month, not on whatever the user
  // browsed to last time.
  useEffect(() => {
    if (!open) return;
    setPeriod(monthOptions(entries)[0]?.key ?? ALL_PERIOD);
    setSearch('');
    setTypeFilter('all');
    setBudgetDraft(budget === null ? '' : String(budget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const periodEntries = useMemo(() => filterByPeriod(entries, period), [entries, period]);
  const totals = useMemo(() => summarize(periodEntries), [periodEntries]);
  const visibleEntries = useMemo(
    () => filterEntries(periodEntries, { search, type: typeFilter }),
    [periodEntries, search, typeFilter],
  );
  const days = useMemo(() => groupByDay(visibleEntries), [visibleEntries]);
  const categories = useMemo(
    () => categoryTotals(visibleEntries, typeFilter === 'income' ? 'income' : 'expense'),
    [visibleEntries, typeFilter],
  );
  const series = useMemo(() => monthlySeries(entries, 6), [entries]);

  const peak = Math.max(1, ...series.flatMap((point) => [point.income, point.expense]));
  const categoryPeak = Math.max(1, ...categories.map((row) => row.total));
  const isMonth = period !== ALL_PERIOD;
  const monthExpense = totals.expense;
  const budgetUsed =
    budget !== null && budget > 0 ? Math.min(100, (monthExpense / budget) * 100) : 0;
  const overBudget = budget !== null && budget > 0 && monthExpense > budget;

  const exportCsv = () => {
    const blob = new Blob([`\uFEFF${toCsv(periodEntries)}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `finance-${period === ALL_PERIOD ? 'all' : period}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const saveBudget = () => {
    const trimmed = budgetDraft.replace(/,/g, '').trim();
    if (!trimmed) {
      onBudgetChange?.(null);
      return;
    }
    const value = Number.parseFloat(trimmed);
    if (!Number.isFinite(value) || value <= 0) return;
    onBudgetChange?.(Math.round(value * 100) / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--success-soft)] text-[var(--success-ink)]">
              <BarChart3 size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[17px] text-[var(--ink)]">
                ภาพรวมรายรับ – รายจ่าย
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] text-[var(--ink-tertiary)]">
                สรุปตามเดือน หมวดหมู่ และเทียบกับ 6 เดือนล่าสุด
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="finance-period" className="text-[12px] font-semibold text-[var(--ink-muted)]">
              ช่วงเวลา
            </label>
            <select
              id="finance-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
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
            <div className="rounded-[14px] bg-[var(--success-soft)] px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[var(--success-ink)]">รายรับ</span>
              <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[var(--ink)]">
                {money.format(totals.income)}
              </span>
            </div>
            <div className="rounded-[14px] bg-[var(--danger-soft)] px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[var(--danger-ink)]">รายจ่าย</span>
              <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[var(--ink)]">
                {money.format(totals.expense)}
              </span>
            </div>
            <div className="rounded-[14px] bg-[var(--surface-grouped)] px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[var(--ink-muted)]">คงเหลือ</span>
              <span
                className={`mt-0.5 block tabular-nums text-[15px] font-extrabold ${
                  totals.balance < 0 ? 'text-[var(--danger-ink)]' : 'text-[var(--ink)]'
                }`}
              >
                {money.format(totals.balance)}
              </span>
            </div>
            <div className="rounded-[14px] bg-[var(--surface-grouped)] px-3 py-2.5">
              <span className="block text-[11px] font-semibold text-[var(--ink-muted)]">รายการ</span>
              <span className="mt-0.5 block tabular-nums text-[15px] font-extrabold text-[var(--ink)]">
                {totals.count}
              </span>
            </div>
          </div>

          {isMonth && (
            <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] font-semibold text-[var(--ink-muted)]">
                  งบรายจ่ายต่อเดือน
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={budgetDraft}
                    onChange={(event) => setBudgetDraft(event.target.value)}
                    placeholder="เช่น 15000"
                    aria-label="งบรายจ่ายต่อเดือน"
                    className="w-[104px] rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface)] px-2 py-1 text-[12px] tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                  <button
                    type="button"
                    onClick={saveBudget}
                    className="rounded-full bg-[var(--accent)] px-3 py-1 text-[11.5px] font-bold text-white transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    บันทึกงบ
                  </button>
                  {budget !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetDraft('');
                        onBudgetChange?.(null);
                      }}
                      className="rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-chip)]"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              </div>

              {budget !== null && budget > 0 && (
                <div className="mt-2">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="text-[var(--ink-tertiary)]">
                      รายจ่ายในช่วงนี้ {money.format(monthExpense)} จากงบ {money.format(budget)}
                    </span>
                    <span
                      className={`tabular-nums font-bold ${
                        overBudget ? 'text-[var(--danger-ink)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {Math.round(budgetUsed)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-chip)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        overBudget
                          ? 'bg-[var(--danger)]'
                          : budgetUsed > 80
                            ? 'bg-[var(--warning)]'
                            : 'bg-[var(--success)]'
                      }`}
                      style={{ width: `${Math.max(2, budgetUsed)}%` }}
                    />
                  </div>
                  {overBudget && (
                    <p className="mt-1 text-[10.5px] font-semibold text-[var(--danger-ink)]">
                      เกินงบไป {money.format(monthExpense - budget)} แล้ว
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trend — always the last six months, independent of the picker. */}
          <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-[var(--ink-muted)]">6 เดือนล่าสุด</span>
              <div className="flex items-center gap-3 text-[10.5px] text-[var(--ink-muted)]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--success)]" aria-hidden="true" />
                  รายรับ
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--danger)]" aria-hidden="true" />
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
                      className="w-2.5 rounded-t-[3px] bg-[var(--success)] transition-all duration-300"
                      style={{
                        height: `${Math.max(point.income > 0 ? 4 : 0, (point.income / peak) * 100)}%`,
                      }}
                    />
                    <span
                      className="w-2.5 rounded-t-[3px] bg-[var(--danger)] transition-all duration-300"
                      style={{
                        height: `${Math.max(point.expense > 0 ? 4 : 0, (point.expense / peak) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="truncate text-[10px] text-[var(--ink-tertiary)]">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown for the period. */}
          {categories.length > 0 && (
            <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-3">
              <span className="text-[11.5px] font-semibold text-[var(--ink-muted)]">
                แยกตามหมวด ({typeFilter === 'income' ? 'รายรับ' : 'รายจ่าย'})
              </span>
              <ul className="mt-2 space-y-2">
                {categories.map((row) => (
                  <li key={row.category}>
                    <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                      <span className="min-w-0 truncate text-[var(--ink)]">{row.category}</span>
                      <span className="shrink-0 tabular-nums font-semibold text-[var(--ink-muted)]">
                        {money.format(row.total)}
                        <span className="ml-1 text-[10px] text-[var(--ink-faint)]">({row.count})</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-chip)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.max(2, (row.total / categoryPeak) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Search + type filter for the day-by-day list. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหารายการหรือหมวดหมู่"
                aria-label="ค้นหารายการ"
                className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
              />
            </div>
            <div
              className="inline-flex rounded-full bg-[var(--surface-chip)] p-0.5"
              role="group"
              aria-label="กรองประเภทรายการ"
            >
              {(
                [
                  ['all', 'ทั้งหมด'],
                  ['income', 'รายรับ'],
                  ['expense', 'รายจ่าย'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  aria-pressed={typeFilter === value}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    typeFilter === value ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Day-by-day list for the selected period. */}
          <div className="space-y-2">
            {days.length === 0 ? (
              <div className="flex min-h-[92px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-3 py-4 text-center text-[12.5px] text-[var(--ink-tertiary)]">
                <Wallet size={18} className="mb-1.5 text-[var(--ink-faint)]" aria-hidden="true" />
                {periodEntries.length === 0
                  ? 'ยังไม่มีรายการในช่วงนี้'
                  : 'ไม่พบรายการที่ตรงกับเงื่อนไข'}
              </div>
            ) : (
              days.map((day) => (
                <div key={day.date} className="rounded-[14px] bg-[var(--surface-subtle)] px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2 pb-1.5">
                    <span className="text-[11.5px] font-bold text-[var(--ink-muted)]">{day.label}</span>
                    <span className="tabular-nums text-[11px] font-semibold text-[var(--ink-tertiary)]">
                      รับ {money.format(day.income)} · จ่าย {money.format(day.expense)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {day.entries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2.5">
                        {entry.type === 'income' ? (
                          <ArrowUpCircle
                            size={15}
                            className="shrink-0 text-[var(--success-ink)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDownCircle
                            size={15}
                            className="shrink-0 text-[var(--danger-ink)]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink)]">
                          {entry.label || (entry.type === 'income' ? 'รายรับ' : 'รายจ่าย')}
                          {entry.category && (
                            <span className="ml-1.5 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--ink-muted)] ring-1 ring-black/[0.05]">
                              {entry.category}
                            </span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums text-[12.5px] font-bold ${
                            entry.type === 'income' ? 'text-[var(--success-ink)]' : 'text-[var(--ink)]'
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

        <DialogFooter className="justify-between sm:justify-between">
          <button
            type="button"
            onClick={exportCsv}
            disabled={periodEntries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] disabled:opacity-40"
          >
            <Download size={13} aria-hidden="true" />
            ส่งออก CSV ({periodEntries.length})
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            เสร็จสิ้น
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
