'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Palmtree,
  Sparkles,
  CheckCircle2,
  CalendarHeart,
  Building2,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import PersonalReminders from './PersonalReminders';
import { buildHolidayDiff, mergeHolidayItems } from '@/utils/holidays';
import type { CompanyHolidayInput } from '@/utils/holidays';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { readCached, writeCached } from '@/lib/offline/localStore';
import { usePreferences } from '@/hooks/usePreferences';
import { formatLongDate, formatMonthShort, formatWeekday, formatYear } from '@/utils/dateFormat';

export type { HolidayItem } from '@/utils/holidays';

export default function HolidayWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const preferences = usePreferences();
  const [filterMode, setFilterMode] = useState<'upcoming' | 'all'>('upcoming');
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHolidayInput[]>([]);
  const [companyYears, setCompanyYears] = useState<number[]>([]);

  // The company calendar is workspace data, so it lives on the server; the last
  // copy stays in the offline mirror so the widget still knows the days HR
  // published when there is no connection.
  useEffect(() => {
    const cached = readCached<CompanyHolidayInput[]>('planner/holidays');
    if (cached?.data) setCompanyHolidays(cached.data);

    let cancelled = false;
    (async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        const res = await fetchWithAuth('/api/v1/planner/holidays');
        if (!res.ok) return;
        const body = (await res.json()) as { years?: Record<string, CompanyHolidayInput[]> };
        const years = Object.keys(body.years ?? {}).map(Number).filter(Number.isFinite);
        const flat = years.flatMap((year) => body.years?.[String(year)] ?? []);
        if (cancelled) return;
        setCompanyHolidays(flat);
        setCompanyYears(years);
        writeCached('planner/holidays', flat);
      } catch {
        // The bundled public calendar still renders.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const holidaysWithDiff = useMemo(() => {
    return buildHolidayDiff(mergeHolidayItems(today.getFullYear(), companyHolidays), today);
  }, [today, companyHolidays]);
  const calendarYear = today.getFullYear();
  const hasCalendar = holidaysWithDiff.length > 0;

  const nextHoliday = useMemo(() => {
    return holidaysWithDiff.find((h) => h.daysLeft >= 0) || holidaysWithDiff[0];
  }, [holidaysWithDiff]);

  const upcomingCount = useMemo(
    () => holidaysWithDiff.filter((h) => h.daysLeft >= 0).length,
    [holidaysWithDiff],
  );

  const displayedHolidays = useMemo(() => {
    let result = holidaysWithDiff;
    if (filterMode === 'upcoming') {
      const upcomingList = holidaysWithDiff.filter((h) => h.daysLeft >= 0);
      result = upcomingList.length > 0 ? upcomingList : holidaysWithDiff;
    }

    // A one-column tile only has room for the next few dates; the "ทั้งหมด"
    // tab still reaches the rest and the list scrolls.
    if (width === 1) return result.slice(0, filterMode === 'upcoming' ? 3 : 6);

    return result;
  }, [filterMode, holidaysWithDiff, width]);

  const companyCalendar = companyYears.includes(calendarYear);

  return (
    <section
      className="flex h-full flex-col rounded-[18px] bg-[var(--surface)] p-4 border border-[var(--hairline)] transition-all duration-200"
      aria-labelledby="holiday-widget-title"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Palmtree size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2
                id="holiday-widget-title"
                className="truncate text-[15px] font-bold tracking-tight text-[var(--ink)]"
              >
                วันหยุดนักขัตฤกษ์
              </h2>
              <span className="shrink-0 rounded-full bg-[var(--surface-grouped-2)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-muted)]">
                {hasCalendar ? formatYear(calendarYear, preferences) : 'ยังไม่พร้อม'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--ink-tertiary)]">
              {companyCalendar ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 size={10} aria-hidden="true" /> ปฏิทินบริษัท
                </span>
              ) : (
                'ปฏิทินวันหยุดราชการและประเพณี'
              )}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      {!hasCalendar && (
        <div className="mt-3 rounded-[14px] border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft-weak)] p-3 text-center">
          <CalendarHeart className="mx-auto text-[var(--accent-text)]" size={20} aria-hidden="true" />
          <p className="mt-1.5 text-[13px] font-bold text-[var(--ink)]">
            ยังไม่มีปฏิทินวันหยุดปี {formatYear(calendarYear, preferences)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-tertiary)]">
            จะแสดงข้อมูลเมื่อเพิ่มปฏิทินที่ยืนยันแล้ว
          </p>
        </div>
      )}

      {/* ── Next holiday (one compact row) ──────────────────────────── */}
      {nextHoliday && (
        <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2.5">
          <CalendarDays
            size={16}
            className="shrink-0 text-[var(--accent-text)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
              วันหยุดถัดไป
            </p>
            <p className="truncate text-[13px] font-extrabold text-[var(--ink)]">
              {nextHoliday.title}
            </p>
            <p className="truncate text-[11px] text-[var(--ink-muted)]">
              {formatLongDate(nextHoliday.dateObj, preferences)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              nextHoliday.isToday
                ? 'bg-[var(--success)] text-white'
                : 'bg-[var(--glass-95)] text-[var(--accent-text)] ring-1 ring-[var(--hairline)]'
            }`}
          >
            {nextHoliday.isToday ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles size={11} aria-hidden="true" /> วันนี้
              </span>
            ) : (
              `อีก ${nextHoliday.daysLeft} วัน`
            )}
          </span>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className={`mt-3 flex items-center gap-1 ${hasCalendar ? '' : 'hidden'}`}>
        {(
          [
            ['upcoming', `ถัดไป (${upcomingCount})`],
            ['all', `ทั้งหมด (${holidaysWithDiff.length})`],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilterMode(mode)}
            aria-pressed={filterMode === mode}
            className={`small-control rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all duration-150 ${
              filterMode === mode
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'text-[var(--ink-tertiary)] hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div
        className={`mt-1.5 overflow-y-auto ${hasCalendar ? '' : 'hidden'} ${
          width >= 3
            ? 'grid max-h-56 grid-cols-1 gap-0.5 md:grid-cols-2'
            : width >= 2
              ? 'flex max-h-52 flex-col gap-0.5'
              : 'flex max-h-44 flex-col gap-0.5'
        }`}
      >
        {displayedHolidays.map((item) => {
          const isNext = item.id === nextHoliday?.id;
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-2 rounded-[11px] px-2 py-1.5 transition-colors ${
                isNext
                  ? 'bg-[var(--accent-soft-weak)]'
                  : item.isPast
                    ? 'opacity-55 hover:bg-[var(--surface-grouped)]'
                    : 'hover:bg-[var(--surface-grouped)]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-[11px] leading-none ${
                    isNext
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface-grouped-2)] text-[var(--ink)]'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                    {formatMonthShort(item.dateObj, preferences)}
                  </span>
                  <span className="mt-0.5 text-[13px] font-bold">{item.day}</span>
                </div>
                <div className="min-w-0">
                  <p
                    className={`truncate text-[13px] font-semibold ${
                      isNext ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-[var(--ink-tertiary)]">
                    {formatWeekday(item.dateObj, preferences)}
                  </p>
                </div>
              </div>

              <span className="shrink-0">
                {item.isPast ? (
                  <CheckCircle2
                    size={13}
                    className="text-[var(--ink-tertiary)]"
                    aria-label="ผ่านแล้ว"
                  />
                ) : item.isToday ? (
                  <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--success)]">
                    วันนี้
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    อีก {item.daysLeft} วัน
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {preferences.personalReminderAlerts && (
        <div className="mt-auto pt-3">
          <PersonalReminders />
        </div>
      )}
    </section>
  );
}
