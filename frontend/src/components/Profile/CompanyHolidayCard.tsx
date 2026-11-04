'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarPlus,
  Check,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface HolidayRow {
  date: string;
  title: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function formatThaiDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

/**
 * Company holiday calendar, imported from the PDF HR publishes.
 *
 * It lives in general settings rather than the admin console: every member can
 * read the calendar, and only an admin gets the import and edit controls
 * (`canEdit`), matching the admin-only write endpoints.
 *
 * Nothing is saved until the admin confirms the preview: PDF extraction is
 * best-effort, so the draft is editable and a bad parse cannot silently replace
 * a calendar that is already in use.
 */
export default function CompanyHolidayCard({ canEdit = true }: { canEdit?: boolean }) {
  const { t } = useI18n();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [savedYears, setSavedYears] = useState<Record<number, number>>({});
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCalendar = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/planner/holidays');
      if (!res.ok) return;
      const body = (await res.json()) as {
        years?: Record<string, { date: string; title: string }[]>;
      };
      const counts: Record<number, number> = {};
      Object.entries(body.years ?? {}).forEach(([key, items]) => {
        counts[Number(key)] = items.length;
      });
      setSavedYears(counts);
      const current = body.years?.[String(year)] ?? [];
      setRows(current.map((item) => ({ date: item.date, title: item.title })));
    } catch {
      // The card still works for a fresh import.
    }
  }, [year]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const importPdf = async (file: File) => {
    setImporting(true);
    setMessage(null);
    setWarnings([]);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetchWithAuth('/api/v1/planner/holidays/import', {
        method: 'POST',
        body: form,
      });
      const body = (await res.json()) as {
        year?: number | null;
        items?: HolidayRow[];
        warnings?: string[];
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const imported = Array.isArray(body.items) ? body.items : [];
      setRows(imported);
      if (typeof body.year === 'number') setYear(body.year);
      setWarnings(Array.isArray(body.warnings) ? body.warnings : []);
      setMessage({
        tone: imported.length > 0 ? 'ok' : 'error',
        text:
          imported.length > 0
            ? `อ่านได้ ${imported.length} วัน — ตรวจสอบแล้วกดบันทึก`
            : 'ไม่พบวันที่ในไฟล์ กรุณาเพิ่มเองในตาราง',
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'นำเข้า PDF ไม่สำเร็จ',
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    const cleaned = rows.filter((row) => row.date && row.title.trim());
    const wrongYear = cleaned.find((row) => !row.date.startsWith(`${year}-`));
    if (wrongYear) {
      setMessage({ tone: 'error', text: `วันที่ ${wrongYear.date} ไม่อยู่ในปี ${year}` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth('/api/v1/planner/holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          items: cleaned.map((row) => ({ date: row.date, title: row.title.trim() })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      setMessage({ tone: 'ok', text: `บันทึกปฏิทินปี ${year} จำนวน ${cleaned.length} วันแล้ว` });
      await loadCalendar();
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'บันทึกปฏิทินไม่สำเร็จ',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeYear = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth(`/api/v1/planner/holidays/${year}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows([]);
      setMessage({ tone: 'ok', text: `ลบปฏิทินปี ${year} แล้ว` });
      await loadCalendar();
    } catch {
      setMessage({ tone: 'error', text: 'ลบปฏิทินไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Building2 size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
              {t('card.companyHolidays.title')}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
              {t(
                canEdit
                  ? 'card.companyHolidays.subtitle.edit'
                  : 'card.companyHolidays.subtitle.read',
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-[var(--ink-muted)]" htmlFor="holiday-year">
            ปี
          </label>
          <input
            id="holiday-year"
            type="number"
            value={year}
            min={2000}
            max={2200}
            disabled={!canEdit}
            onChange={(event) => setYear(Number(event.target.value) || CURRENT_YEAR)}
            className="w-24 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink)] outline-hidden focus:border-[var(--accent)] disabled:opacity-60"
          />
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              id="holiday-pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importPdf(file);
              }}
            />
            <label
              htmlFor="holiday-pdf"
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12.5px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] ${
                importing ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              {importing ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload size={14} aria-hidden="true" />
              )}
              {importing ? 'กำลังอ่าน PDF…' : 'อัปโหลด PDF วันหยุด'}
            </label>

            <button
              type="button"
              onClick={() =>
                setRows((current) => [...current, { date: `${year}-01-01`, title: '' }])
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)]"
            >
              <CalendarPlus size={14} aria-hidden="true" /> เพิ่มวันเอง
            </button>

            {savedYears[year] ? (
              <button
                type="button"
                onClick={() => void removeYear()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden="true" /> ลบปฏิทินปีนี้
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || rows.length === 0}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--success)] px-4 py-2 text-[12.5px] font-bold text-white shadow-xs transition-all hover:opacity-90 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Check size={14} aria-hidden="true" />
              )}
              บันทึกปฏิทิน
            </button>
          </div>
        )}

        {message && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-[12px] border p-3 text-[12.5px] ${
              message.tone === 'ok'
                ? 'border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success-ink)]'
                : 'border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger-ink)]'
            }`}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{message.text}</span>
          </div>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-[12px] bg-[var(--surface-subtle)] p-3 text-[11.5px] text-[var(--ink-muted)]">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>• {warning}</li>
            ))}
          </ul>
        )}

        {rows.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[var(--hairline)] bg-[var(--surface-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-tertiary)]">
            {canEdit
              ? `ยังไม่มีปฏิทินปี ${year} — อัปโหลด PDF หรือเพิ่มวันเอง แล้วกดบันทึก`
              : `ยังไม่มีปฏิทินวันหยุดปี ${year}`}
          </p>
        ) : canEdit ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--hairline)]">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-[var(--surface-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">ชื่อวันหยุด</th>
                  <th className="px-3 py-2" aria-label="ลบ" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.date}-${index}`} className="border-t border-[var(--hairline-soft)]">
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item, position) =>
                              position === index ? { ...item, date: event.target.value } : item,
                            ),
                          )
                        }
                        aria-label={`วันที่รายการที่ ${index + 1}`}
                        className="rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-hidden focus:border-[var(--accent)]"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={row.title}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item, position) =>
                              position === index ? { ...item, title: event.target.value } : item,
                            ),
                          )
                        }
                        aria-label={`ชื่อวันหยุดรายการที่ ${index + 1}`}
                        className="w-full rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-hidden focus:border-[var(--accent)]"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setRows((current) => current.filter((_, position) => position !== index))
                        }
                        aria-label={`ลบรายการที่ ${index + 1}`}
                        className="rounded-full p-1 text-[var(--ink-tertiary)] transition-colors hover:text-[var(--danger)]"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="max-h-72 divide-y divide-[var(--hairline-soft)] overflow-y-auto rounded-[12px] border border-[var(--hairline)]">
            {rows.map((row, index) => (
              <div
                key={`${row.date}-${index}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--ink)]">
                  {row.title}
                </span>
                <span className="shrink-0 text-[11.5px] text-[var(--ink-muted)]">
                  {formatThaiDate(row.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
