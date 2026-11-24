/**
 * Filename for an /audit CSV export.
 *
 * The date range is what makes two exports distinguishable later, so it goes in
 * the name: `audit-log_2026-11-01_to_2026-11-24.csv`. A one-sided filter keeps
 * its side (`_from_…` / `_until_…`); an unfiltered export carries the day it
 * was taken, because "audit-log.csv" cannot be told apart from a newer one.
 */
export function auditExportFilename(from: string, to: string, today: Date = new Date()): string {
  if (from && to) return `audit-log_${from}_to_${to}.csv`;
  if (from) return `audit-log_from_${from}.csv`;
  if (to) return `audit-log_until_${to}.csv`;

  const stamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return `audit-log_all_${stamp}.csv`;
}
