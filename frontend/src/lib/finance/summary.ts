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
  /** Free-text category; older rows have none. */
  category?: string;
}

/** Period value meaning "every entry, no month filter". */
export const ALL_PERIOD = 'all';

/** Must match the server cap in `personal_lists.MAX_FINANCE_ENTRIES`. */
export const MAX_FINANCE_ENTRIES = 2000;

/** Must match `MAX_FINANCE_LABEL` on the server. */
export const MAX_FINANCE_LABEL = 60;

/** Must match `MAX_MONEY` on the server. */
export const MAX_FINANCE_AMOUNT = 1_000_000_000;

/** Category suggestions — the field stays free text so users are not boxed in. */
export const FINANCE_CATEGORIES = [
  'อาหาร',
  'เดินทาง',
  'ที่พัก',
  'ช้อปปิ้ง',
  'สุขภาพ',
  'บิลและค่าบริการ',
  'บันเทิง',
  'การศึกษา',
  'เงินเดือน',
  'ขายของ',
  'อื่น ๆ',
] as const;

/** Shown as the category of entries saved before categories existed. */
export const UNCATEGORIZED_LABEL = 'ไม่ระบุหมวด';

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

/** `YYYY-MM-DD` of the local calendar day. */
export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/**
 * Parse the amount field strictly.
 *
 * `parseFloat` accepts "12abc" as 12 and "1.2.3" as 1.2, which used to save a
 * number the user never typed. Only digits, optional thousands separators and
 * at most two decimals are accepted; comma group positions are not policed
 * because Thai users type both "1,200" and "1,200.50".
 */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_FINANCE_AMOUNT) return null;
  return Math.round(value * 100) / 100;
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
export function filterByPeriod(entries: FinanceEntry[], period: string): FinanceEntry[] {
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

// ── Filtering, category breakdown, CSV ──────────────────────────────────────

export interface EntryFilter {
  /** Free text matched against the label and the category. */
  search?: string;
  type?: EntryType | 'all';
}

/** Entries matching a free-text search and/or a type filter. */
export function filterEntries(entries: FinanceEntry[], filter: EntryFilter): FinanceEntry[] {
  const search = (filter.search ?? '').trim().toLowerCase();
  const type = filter.type ?? 'all';

  return entries.filter((entry) => {
    if (type !== 'all' && entry.type !== type) return false;
    if (!search) return true;
    return (
      entry.label.toLowerCase().includes(search) ||
      (entry.category ?? '').toLowerCase().includes(search)
    );
  });
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

/**
 * Totals per category for one side of the ledger, biggest first. Entries with no
 * category (saved before the field existed, or left blank) are grouped under
 * `UNCATEGORIZED_LABEL` rather than dropped, so the breakdown always adds up to
 * the period total.
 */
export function categoryTotals(
  entries: FinanceEntry[],
  type: EntryType = 'expense',
): CategoryTotal[] {
  const buckets = new Map<string, CategoryTotal>();
  for (const entry of entries) {
    if (entry.type !== type) continue;
    const category = (entry.category ?? '').trim() || UNCATEGORIZED_LABEL;
    const amount = Number.isFinite(entry.amount) ? entry.amount : 0;
    const bucket = buckets.get(category);
    if (bucket) {
      bucket.total += amount;
      bucket.count += 1;
    } else {
      buckets.set(category, { category, total: amount, count: 1 });
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, total: round2(bucket.total) }))
    .sort((a, b) => b.total - a.total);
}

const CSV_HEADERS = ['วันที่', 'ประเภท', 'หมวดหมู่', 'รายการ', 'จำนวนเงิน'] as const;

function csvCell(value: string): string {
  // Quote every field: labels and categories are free text and may contain
  // commas, quotes or newlines that would otherwise break the columns.
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * The entries as CSV text (no BOM — the caller prepends it when downloading so
 * Excel reads Thai correctly). Newest day first, matching the summary view.
 */
export function toCsv(entries: FinanceEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((entry) =>
      [
        entry.date,
        entry.type === 'income' ? 'รายรับ' : 'รายจ่าย',
        entry.category ?? '',
        entry.label,
        entry.amount.toFixed(2),
      ]
        .map(csvCell)
        .join(','),
    );

  return [CSV_HEADERS.map(csvCell).join(','), ...rows].join('\r\n');
}
