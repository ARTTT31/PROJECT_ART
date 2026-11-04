/** Minimal CSV export used by the admin tables. */

export type CsvValue = string | number | boolean | null | undefined;

/**
 * Quote a field the way spreadsheets expect.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with an apostrophe: exported cells
 * can come from user-supplied text (names, note bodies), and a spreadsheet will
 * otherwise evaluate them as a formula.
 */
function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/["\n\r,;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Trigger a browser download; the BOM keeps Thai text readable in Excel. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** `users-2026-11-04.csv` */
export function datedFilename(prefix: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `${prefix}-${stamp}.csv`;
}
