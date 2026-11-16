'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Date-range picker drawn with the app's own tokens.
 *
 * The native `<input type="date">` renders an OS calendar (mm/dd/yyyy in an
 * English locale, a browser-chrome popup with no theme support) that looked
 * foreign on this page and could not carry a Thai Buddhist-era label. This is a
 * button + portal panel with the same behaviour: pick a start day, pick an end
 * day, or take a preset. Values stay `YYYY-MM-DD` so they go straight into the
 * API query.
 */

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const THAI_MONTHS_FULL = [
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

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const PANEL_WIDTH = 296;
const PANEL_HEIGHT = 356;

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` in local time — never `toISOString()`, which shifts the day. */
function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** `2026-11-16` → `16 พ.ย. 2569` (Buddhist era, as the rest of the app). */
export function formatThaiDate(value: string): string {
  const date = fromIso(value);
  if (!date) return '';
  return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

interface Cell {
  date: Date;
  iso: string;
  inMonth: boolean;
}

/** Six weeks of cells starting on the Sunday before the 1st. */
function buildMonth(cursor: Date): Cell[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, iso: toIso(date), inMonth: date.getMonth() === cursor.getMonth() };
  });
}

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Accessible name of the trigger, e.g. "กรองตามช่วงวันที่". */
  ariaLabel: string;
  className?: string;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  ariaLabel,
  className = '',
}: DateRangePickerProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    maxHeight?: number;
  } | null>(null);

  const selected = useMemo(() => {
    const start = fromIso(from);
    const end = fromIso(to);
    return { start, end };
  }, [from, to]);

  const [cursor, setCursor] = useState<Date>(
    () => selected.start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openPanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeUp = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow;

    // A short viewport (a laptop at 200% zoom, a phone in landscape) fits the
    // panel on neither side. Clamping the top to the viewport keeps the calendar
    // on screen instead of hanging off the top edge; the panel scrolls at that
    // point.
    const top = placeUp
      ? Math.max(8, rect.top - PANEL_HEIGHT - 6)
      : Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - PANEL_HEIGHT - 8));

    setPlacement({
      left: Math.min(rect.left, Math.max(8, window.innerWidth - PANEL_WIDTH - 8)),
      top,
      maxHeight: Math.max(220, window.innerHeight - top - 8),
    });
    setCursor(selected.start ?? new Date());
    setOpen(true);
  }, [selected.start]);

  // Same lifecycle as the Select menu: positioned once, so a scroll or a resize
  // would leave it floating away from its trigger.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (panelRef.current && target instanceof Node && panelRef.current.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    const onResize = () => close(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const pick = (iso: string) => {
    // First click sets the start, second click closes the range. A second click
    // before the start keeps the range ordered instead of producing a negative
    // span the API would reject.
    if (!from || (from && to)) {
      onChange({ from: iso, to: '' });
      return;
    }
    if (iso < from) {
      onChange({ from: iso, to: from });
    } else {
      onChange({ from, to: iso });
    }
    close();
  };

  const applyPreset = (days: number) => {
    const today = new Date();
    onChange({
      from: toIso(addDays(today, -(days - 1))),
      to: toIso(today),
    });
    close();
  };

  const cells = useMemo(() => buildMonth(cursor), [cursor]);
  const today = new Date();

  const triggerLabel =
    from && to
      ? `${formatThaiDate(from)} – ${formatThaiDate(to)}`
      : from
        ? `ตั้งแต่ ${formatThaiDate(from)}`
        : 'เลือกช่วงวันที่';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        className={`inline-flex items-center gap-2 rounded-apple-widget border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 text-left text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-grouped)] focus-visible:border-[var(--accent)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] active:scale-[0.98] ${className}`}
      >
        <Calendar size={15} className="shrink-0 text-[var(--ink-tertiary)]" aria-hidden="true" />
        <span className={`flex-1 truncate tabular-nums ${from || to ? '' : 'text-[var(--ink-tertiary)]'}`}>
          {triggerLabel}
        </span>
        {(from || to) && (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างช่วงวันที่"
            onClick={(event) => {
              event.stopPropagation();
              onChange({ from: '', to: '' });
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onChange({ from: '', to: '' });
            }}
            className="shrink-0 rounded-full p-0.5 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]"
          >
            <X size={13} aria-hidden="true" />
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2.4}
          aria-hidden="true"
          className={`shrink-0 text-[var(--ink-tertiary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        placement &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="เลือกช่วงวันที่"
            style={{
              position: 'fixed',
              left: placement.left,
              width: PANEL_WIDTH,
              top: placement.top,
              bottom: placement.bottom,
              maxHeight: placement.maxHeight,
            }}
            className="z-[70] overflow-y-auto overscroll-contain rounded-apple-lg border border-[var(--hairline)] bg-[var(--glass-95)] p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label="เดือนก่อนหน้า"
                onClick={() =>
                  setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                }
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.92]"
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <span className="text-[13px] font-semibold text-[var(--ink)]">
                {THAI_MONTHS_FULL[cursor.getMonth()]} {cursor.getFullYear() + 543}
              </span>
              <button
                type="button"
                aria-label="เดือนถัดไป"
                onClick={() =>
                  setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                }
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.92]"
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="py-1 text-center text-[11px] font-semibold text-[var(--ink-tertiary)]"
                >
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const isStart = selected.start ? sameDay(cell.date, selected.start) : false;
                const isEnd = selected.end ? sameDay(cell.date, selected.end) : false;
                const inRange =
                  selected.start && selected.end
                    ? cell.iso > toIso(selected.start) && cell.iso < toIso(selected.end)
                    : false;
                const isToday = sameDay(cell.date, today);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    aria-label={`${cell.date.getDate()} ${THAI_MONTHS_FULL[cell.date.getMonth()]} ${cell.date.getFullYear() + 543}`}
                    aria-pressed={isStart || isEnd}
                    onClick={() => pick(cell.iso)}
                    className={`relative flex h-8 items-center justify-center rounded-apple-md text-[12.5px] tabular-nums transition-colors duration-150 active:scale-[0.95] ${
                      isStart || isEnd
                        ? 'bg-[var(--accent)] font-semibold text-white'
                        : inRange
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : cell.inMonth
                            ? 'text-[var(--ink)] hover:bg-[var(--surface-chip)]'
                            : 'text-[var(--ink-faint)] hover:bg-[var(--surface-chip)]'
                    }`}
                  >
                    {cell.date.getDate()}
                    {isToday && !isStart && !isEnd && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--accent)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--hairline)] pt-2.5">
              <button
                type="button"
                onClick={() => applyPreset(1)}
                className="rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] active:scale-[0.95]"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7)}
                className="rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] active:scale-[0.95]"
              >
                7 วัน
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-chip)] active:scale-[0.95]"
              >
                30 วัน
              </button>
              {(from || to) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ from: '', to: '' });
                    close();
                  }}
                  className="ml-auto rounded-full px-2 py-1 text-[11.5px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
