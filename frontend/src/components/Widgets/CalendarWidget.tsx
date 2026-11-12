'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Briefcase,
  Palmtree,
  Star,
  Trash2,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getHolidaysWithDiff, holidayTitle } from '@/utils/holidays';

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  /** English title for the bundled public holidays. */
  titleEn?: string;
  type: 'holiday' | 'reminder';
  kind?: 'errand' | 'leave' | 'other';
  done?: boolean;
}

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const WEEKDAY_NAMES_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const { tr } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(() => today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => today.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [companyHolidays, setCompanyHolidays] = useState<Record<string, string>>({});
  const [reminders, setReminders] = useState<CalendarEvent[]>([]);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderKind, setNewReminderKind] = useState<'errand' | 'leave' | 'other'>('errand');
  const [isAddingReminder, setIsAddingReminder] = useState(false);

  // ── Load Holidays and Reminders ──────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // 1. Load company holidays from API
      try {
        const res = await fetchWithAuth('/api/v1/planner/holidays');
        if (res.ok) {
          const data = await res.json();
          const holidayMap: Record<string, string> = {};
          if (data.years) {
            Object.values(data.years).forEach((yearList) => {
              if (Array.isArray(yearList)) {
                yearList.forEach((item: { date: string; title: string }) => {
                  holidayMap[item.date] = item.title;
                });
              }
            });
          }
          if (isMounted) setCompanyHolidays(holidayMap);
        }
      } catch {
        // Fallback to static holiday calendars
      }

      // 2. Load personal reminders
      try {
        const res = await fetchWithAuth('/api/v1/planner/reminders');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.reminders) && isMounted) {
            const mapped: CalendarEvent[] = data.reminders.map((r: { id: string; date: string; title: string; kind?: 'errand' | 'leave' | 'other'; done?: boolean }) => ({
              id: r.id,
              date: r.date,
              title: r.title,
              type: 'reminder',
              kind: r.kind || 'errand',
              done: !!r.done,
            }));
            setReminders(mapped);
          }
        }
      } catch {
        // Optional failure
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Month Navigation ─────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  }, []);

  // ── Combined Events Map ──────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    // 1. Static fallback holidays
    const staticHolidays = getHolidaysWithDiff(new Date(currentYear, 0, 1));
    staticHolidays.forEach((h) => {
      const dStr = `${h.year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push({
        id: `h-${dStr}`,
        date: dStr,
        title: h.title,
        type: 'holiday',
      });
    });

    // 2. Company holiday overrides
    Object.entries(companyHolidays).forEach(([dateStr, title]) => {
      if (!map[dateStr]) map[dateStr] = [];
      // Replace or add
      const idx = map[dateStr].findIndex((e) => e.type === 'holiday');
      if (idx >= 0) {
        map[dateStr][idx].title = title;
      } else {
        map[dateStr].push({ id: `ch-${dateStr}`, date: dateStr, title, type: 'holiday' });
      }
    });

    // 3. Personal reminders
    reminders.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });

    return map;
  }, [currentYear, companyHolidays, reminders]);

  // ── Calendar Grid Computation ────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0 = Sunday

    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    const days: {
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEvent[];
    }[] = [];

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Leading days from prev month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = currentMonth === 0 ? 12 : currentMonth;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        events: eventsByDate[dStr] || [],
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        events: eventsByDate[dStr] || [],
      });
    }

    // Trailing days to fill 5 or 6 weeks (up to multiple of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        events: eventsByDate[dStr] || [],
      });
    }

    return days;
  }, [currentYear, currentMonth, today, eventsByDate]);

  // Selected date events
  const selectedEvents = eventsByDate[selectedDate] || [];

  // ── Handle Add Reminder ──────────────────────────────────────────────────
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;

    const newRem: CalendarEvent = {
      id: `rem-${Date.now()}`,
      date: selectedDate,
      title: newReminderTitle.trim(),
      type: 'reminder',
      kind: newReminderKind,
      done: false,
    };

    const nextReminders = [...reminders, newRem];
    setReminders(nextReminders);
    setNewReminderTitle('');
    setIsAddingReminder(false);

    // Save to API
    try {
      await fetchWithAuth('/api/v1/planner/reminders', {
        method: 'PUT',
        body: JSON.stringify({
          reminders: nextReminders.map((r) => ({
            id: r.id,
            date: r.date,
            title: r.title,
            kind: r.kind,
            done: r.done,
          })),
        }),
      });
    } catch {
      // Local state preserved
    }
  };

  // ── Toggle Reminder Done ─────────────────────────────────────────────────
  const handleToggleDone = async (id: string) => {
    const nextReminders = reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
    setReminders(nextReminders);
    try {
      await fetchWithAuth('/api/v1/planner/reminders', {
        method: 'PUT',
        body: JSON.stringify({
          reminders: nextReminders.map((r) => ({
            id: r.id,
            date: r.date,
            title: r.title,
            kind: r.kind,
            done: r.done,
          })),
        }),
      });
    } catch {
      // Keep local state
    }
  };

  // ── Delete Reminder ─────────────────────────────────────────────────────
  const handleDeleteReminder = async (id: string) => {
    const nextReminders = reminders.filter((r) => r.id !== id);
    setReminders(nextReminders);
    try {
      await fetchWithAuth('/api/v1/planner/reminders', {
        method: 'PUT',
        body: JSON.stringify({
          reminders: nextReminders.map((r) => ({
            id: r.id,
            date: r.date,
            title: r.title,
            kind: r.kind,
            done: r.done,
          })),
        }),
      });
    } catch {
      // Keep local state
    }
  };

  return (
    <div
      data-testid="calendar-widget"
      className="flex h-full min-h-[260px] flex-col justify-between rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-5 transition-colors"
    >
      {/* Top Header: Title, Month Selector & Size Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-apple-md bg-[var(--surface-chip)] text-[var(--accent)]">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)]">ปฏิทิน & ตารางนัดหมาย</h3>
            <p className="text-[11px] text-[var(--ink-muted)]">
              {THAI_MONTH_NAMES[currentMonth]} {currentYear + 543}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-full bg-[var(--surface-chip)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-grouped)] transition-colors active:scale-[0.95]"
          >
            วันนี้
          </button>
          <div className="flex items-center rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="เดือนก่อนหน้า"
              className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--ink-secondary)] hover:text-[var(--ink)] active:scale-[0.95]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="เดือนถัดไป"
              className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--ink-secondary)] hover:text-[var(--ink)] active:scale-[0.95]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} />}
        </div>
      </div>

      {/* Main Grid & Panels depending on width */}
      <div className="my-auto py-2">
        {width === 1 ? (
          /* Size S: Compact Calendar + Selected Date Preview */
          <div className="flex flex-col gap-2">
            {/* Weekdays */}
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--ink-muted)]">
              {WEEKDAY_NAMES.map((w, idx) => (
                <div key={w} className={idx === 0 || idx === 6 ? 'text-red-500' : ''}>
                  {w}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
              {calendarDays.map((d) => {
                const isSelected = d.dateStr === selectedDate;
                const hasHoliday = d.events.some((e) => e.type === 'holiday');
                const hasReminder = d.events.some((e) => e.type === 'reminder');

                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition-all active:scale-[0.92] ${
                      isSelected
                        ? 'bg-[var(--ink)] text-white shadow-xs font-bold'
                        : d.isToday
                        ? 'bg-[var(--accent)] text-white font-bold'
                        : d.isCurrentMonth
                        ? 'text-[var(--ink)] hover:bg-[var(--surface-chip)]'
                        : 'text-[var(--ink-muted)] opacity-40'
                    }`}
                  >
                    <span>{d.dayNumber}</span>
                    {/* Dots indicator */}
                    {(hasHoliday || hasReminder) && !isSelected && !d.isToday && (
                      <span className="absolute bottom-0.5 flex gap-0.5">
                        {hasHoliday && <span className="h-1 w-1 rounded-full bg-red-500" />}
                        {hasReminder && <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Day Preview */}
            <div className="mt-1 rounded-apple-md border border-[var(--hairline)] bg-[var(--surface-grouped)] px-2.5 py-1.5 text-xs">
              {selectedEvents.length > 0 ? (
                <div className="space-y-0.5">
                  {selectedEvents.slice(0, 2).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-1.5 truncate">
                      {ev.type === 'holiday' ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      )}
                      <span className="truncate font-medium text-[var(--ink)]">{ev.title}</span>
                    </div>
                  ))}
                  {selectedEvents.length > 2 && (
                    <p className="text-[11px] text-[var(--ink-muted)]">
                      +{selectedEvents.length - 2} รายการเพิ่มเติม
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--ink-muted)] text-center">ไม่มีนัดหมายในวันนี้</p>
              )}
            </div>
          </div>
        ) : (
          /* Size M / L: Multi-Column View */
          <div className={`grid gap-4 items-start ${width === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
            {/* Left Column: Calendar Grid */}
            <div className="rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3">
              {/* Weekdays */}
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-[var(--ink-muted)] mb-2">
                {WEEKDAY_NAMES.map((w, idx) => (
                  <div key={w} className={idx === 0 || idx === 6 ? 'text-red-500' : ''}>
                    {w}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {calendarDays.map((d) => {
                  const isSelected = d.dateStr === selectedDate;
                  const hasHoliday = d.events.some((e) => e.type === 'holiday');
                  const hasReminder = d.events.some((e) => e.type === 'reminder');

                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all active:scale-[0.92] ${
                        isSelected
                          ? 'bg-[var(--ink)] text-white shadow-xs font-bold ring-2 ring-[var(--accent)]'
                          : d.isToday
                          ? 'bg-[var(--accent)] text-white font-bold'
                          : d.isCurrentMonth
                          ? 'text-[var(--ink)] hover:bg-[var(--surface-chip)]'
                          : 'text-[var(--ink-muted)] opacity-40'
                      }`}
                    >
                      <span>{d.dayNumber}</span>
                      {(hasHoliday || hasReminder) && !isSelected && !d.isToday && (
                        <span className="absolute bottom-0.5 flex gap-0.5">
                          {hasHoliday && <span className="h-1 w-1 rounded-full bg-red-500" />}
                          {hasReminder && <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Center Column: Selected Date Inspector */}
            <div className="flex flex-col gap-2 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3.5">
              <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-2">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  รายการประจำวันที่ {selectedDate}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingReminder((v) => !v)}
                  className="flex items-center gap-1 rounded-full bg-[var(--surface-chip)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-all active:scale-[0.95]"
                >
                  <Plus className="h-3 w-3" />
                  <span>เพิ่มเตือน</span>
                </button>
              </div>

              {/* Add Reminder Inline Form */}
              {isAddingReminder && (
                <form onSubmit={handleAddReminder} className="flex flex-col gap-2 rounded-apple-md bg-[var(--surface)] p-2.5 border border-[var(--hairline)]">
                  <input
                    type="text"
                    value={newReminderTitle}
                    onChange={(e) => setNewReminderTitle(e.target.value)}
                    placeholder="พิมพ์ชื่อธุระหรือนัดหมาย..."
                    className="w-full rounded-apple-md border border-[var(--hairline)] bg-[var(--surface-grouped)] px-2.5 py-1 text-xs text-[var(--ink)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {(['errand', 'leave', 'other'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setNewReminderKind(k)}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all ${
                            newReminderKind === k
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--surface-chip)] text-[var(--ink-secondary)]'
                          }`}
                        >
                          {k === 'errand' ? 'ธุระ' : k === 'leave' ? 'ลาหยุด' : 'อื่น ๆ'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingReminder(false)}
                        className="rounded-full px-2 py-0.5 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Events List */}
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                {selectedEvents.length > 0 ? (
                  selectedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between rounded-apple-md border border-[var(--hairline)] bg-[var(--surface)] p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {ev.type === 'holiday' ? (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            <Star className="h-3 w-3 fill-current" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleDone(ev.id)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              ev.done
                                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                                : 'border-[var(--hairline)] text-transparent hover:border-[var(--accent)]'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                        <span
                          className={`truncate font-medium ${
                            ev.done ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ink)]'
                          }`}
                        >
                          {ev.title}
                        </span>
                      </div>

                      {ev.type === 'reminder' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(ev.id)}
                          aria-label="ลบเตือน"
                          className="text-[var(--ink-muted)] hover:text-red-500 transition-colors ml-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-xs text-[var(--ink-muted)]">
                    ไม่มีรายการในวันที่เลือก
                  </p>
                )}
              </div>
            </div>

            {/* Right Column (Size L only): Summary Stats */}
            {width === 3 && (
              <div className="flex flex-col gap-3 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3.5">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  สรุปวันสำคัญเดือน{THAI_MONTH_NAMES[currentMonth]}
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-apple-md bg-[var(--surface)] p-2.5">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-red-500" />
                      <span className="text-[var(--ink-secondary)]">วันหยุดในเดือนนี้</span>
                    </div>
                    <span className="font-semibold text-[var(--ink)]">
                      {
                        calendarDays.filter((d) => d.isCurrentMonth && d.events.some((e) => e.type === 'holiday'))
                          .length
                      }{' '}
                      วัน
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-apple-md bg-[var(--surface)] p-2.5">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[var(--accent)]" />
                      <span className="text-[var(--ink-secondary)]">นัดหมาย / ธุระ</span>
                    </div>
                    <span className="font-semibold text-[var(--ink)]">
                      {reminders.filter((r) => r.kind === 'errand' && !r.done).length} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-apple-md bg-[var(--surface)] p-2.5">
                    <div className="flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-emerald-500" />
                      <span className="text-[var(--ink-secondary)]">วันลาพักผ่อน</span>
                    </div>
                    <span className="font-semibold text-[var(--ink)]">
                      {reminders.filter((r) => r.kind === 'leave').length} วัน
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-2 text-[11px] text-[var(--ink-muted)]">
        <span>เลือกวันที่: {selectedDate}</span>
        <span>
          {selectedEvents.length} รายการ (
          {selectedEvents.filter((e) => e.type === 'holiday').length} วันหยุด /{' '}
          {selectedEvents.filter((e) => e.type === 'reminder').length} เตือน)
        </span>
      </div>
    </div>
  );
}
