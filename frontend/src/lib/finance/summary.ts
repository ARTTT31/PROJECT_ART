/**
 * Income / expense aggregation for the finance summary view.
 *
 * Entries live in one flat, dated list (`/profile/finance`), so every period
 * view — today, one month, all time — is a filter over that list plus a sum.
 * Keeping that logic here (instead of inside the widget) means the dashboard
 * widget, the summary dialog and the tests all agree on boundaries and
 * rounding.
 */

export type EntryType = 'income' | 'expense';

export interface FinanceEntry {
  id: string;
  type: EntryType;
  label: string;
  amount: number;
  date: string;
}

/** Period value meaning "every entry, no month filter". */
export const ALL_PERIOD = 'all';

export interface MonthOption {
  key: string;
  label: string;
}

export interface Totals {
  income: number;
  expense: number;
  balance: number;
  count: number;
}

export interface DayGroup {
  date: string;
  label: string;
  entries: FinanceEntry[];
  income: number;
  expense: number;
}

export interface MonthPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** `YYYY-MM-DD` prefix of an entry date, or '' when the value is unusable. */
export function monthKeyOf(date: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})/.exec(date ?? '');
  return match ? `${match[1]}-${match[2]}` : '';
}

/** Month key (`YYYY-MM`) of a Date in local time. */
export function monthKeyOfDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyOfDate(now);
}

function parseMonthKey(key: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Full Thai month label for a `YYYY-MM` key (Buddhist era, e.g. "มกราคม 2569"). */
export function monthLabel(key: string): string {
  const parts = parseMonthKey(key);
  if (!parts) return key;
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(
    new Date(parts.year, parts.month - 1, 1),
  );
}

/** Short Thai month label for chart axes (e.g. "ม.ค."). */
export function shortMonthLabel(key: string): string {
  const parts = parseMonthKey(key);
  if (!parts) return key;
  return new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(
    new Date(parts.year, parts.month - 1, 1),
  );
}

/** `YYYY-MM-DD` in local time. */
export function dateKey(date: Date): string {
  return `${monthKeyOfDate(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Months to offer in the picker: the current month first (so an empty "this
 * month" is selectable), then every month that actually has entries, newest
 * first.
 */
export function monthOptions(entries: FinanceEntry[], now: Date = new Date()): MonthOption[] {
  const keys = new Set<string>([currentMonthKey(now)]);
  for (const entry of entries) {
    const key = monthKeyOf(entry.date);
    if (key) keys.add(key);
  }
  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((key) => ({ key, label: monthLabel(key) }));
}

/** Entries inside one month key, or all entries when the period is "all". */
export function filterByPeriod(
  entries: FinanceEntry[],
  period: string,
): FinanceEntry[] {
  if (period === ALL_PERIOD) return entries;
  return entries.filter((entry) => monthKeyOf(entry.date) === period);
}

export function summarize(entries: FinanceEntry[]): Totals {
  let income = 0;
  let expense = 0;
  for (const entry of entries) {
    const amount = Number.isFinite(entry.amount) ? entry.amount : 0;
    if (entry.type === 'income') income += amount;
    else expense += amount;
  }
  income = round2(income);
  expense = round2(expense);
  return { income, expense, balance: round2(income - expense), count: entries.length };
}

/** Day label: "วันนี้", "เมื่อวาน", or a Thai date for older days. */
export function dayLabel(date: string, today: Date = new Date()): string {
  const todayKey = dateKey(today);
  if (date === todayKey) return 'วันนี้';

  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date === dateKey(yesterday)) return 'เมื่อวาน';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Entries grouped per day, newest day first, newest entry first inside a day. */
export function groupByDay(entries: FinanceEntry[], now: Date = new Date()): DayGroup[] {
  const buckets = new Map<string, FinanceEntry[]>();
  for (const entry of entries) {
    const key = entry.date || '';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayEntries]) => {
      const totals = summarize(dayEntries);
      return {
        date,
        label: dayLabel(date, now),
        entries: dayEntries,
        income: totals.income,
        expense: totals.expense,
      };
    });
}

/**
 * The last `months` calendar months (oldest first), with totals per month —
 * the trend line behind the monthly view.
 */
export function monthlySeries(
  entries: FinanceEntry[],
  months = 6,
  now: Date = new Date(),
): MonthPoint[] {
  const points: MonthPoint[] = [];
  const buckets = new Map<string, FinanceEntry[]>();
  for (const entry of entries) {
    const key = monthKeyOf(entry.date);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKeyOfDate(cursor);
    const totals = summarize(buckets.get(key) ?? []);
    points.push({
      key,
      label: shortMonthLabel(key),
      income: totals.income,
      expense: totals.expense,
    });
  }

  return points;
}
