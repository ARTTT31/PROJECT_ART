'use client'

import { useState, useMemo } from 'react'
import {
  CalendarDays,
  Palmtree,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  CalendarHeart,
} from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'

// ── Holiday Data (17 Official Holidays 2569 / 2026) ──────────────────────────

export interface HolidayItem {
  id: string
  dayOfWeek: string
  day: number
  month: number // 1-12
  monthName: string
  year: number
  title: string
  description?: string
}

const THAI_HOLIDAYS_2026: HolidayItem[] = [
  { id: 'h-1', dayOfWeek: 'วันพฤหัสบดี', day: 1, month: 1, monthName: 'มกราคม', year: 2026, title: 'วันขึ้นปีใหม่' },
  { id: 'h-2', dayOfWeek: 'วันอังคาร', day: 3, month: 3, monthName: 'มีนาคม', year: 2026, title: 'วันมาฆบูชา' },
  { id: 'h-3', dayOfWeek: 'วันจันทร์', day: 6, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันจักรี' },
  { id: 'h-4', dayOfWeek: 'วันจันทร์', day: 13, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันสงกรานต์' },
  { id: 'h-5', dayOfWeek: 'วันอังคาร', day: 14, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันสงกรานต์' },
  { id: 'h-6', dayOfWeek: 'วันพุธ', day: 15, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันสงกรานต์' },
  { id: 'h-7', dayOfWeek: 'วันศุกร์', day: 1, month: 5, monthName: 'พฤษภาคม', year: 2026, title: 'วันแรงงานแห่งชาติ' },
  { id: 'h-8', dayOfWeek: 'วันจันทร์', day: 4, month: 5, monthName: 'พฤษภาคม', year: 2026, title: 'วันฉัตรมงคล' },
  { id: 'h-9', dayOfWeek: 'วันพุธ', day: 3, month: 6, monthName: 'มิถุนายน', year: 2026, title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี' },
  { id: 'h-10', dayOfWeek: 'วันอังคาร', day: 28, month: 7, monthName: 'กรกฎาคม', year: 2026, title: 'วันเฉลิมพระชนมพรรษาพระเจ้าอยู่หัว' },
  { id: 'h-11', dayOfWeek: 'วันพุธ', day: 29, month: 7, monthName: 'กรกฎาคม', year: 2026, title: 'วันอาสาฬหบูชา' },
  { id: 'h-12', dayOfWeek: 'วันพุธ', day: 12, month: 8, monthName: 'สิงหาคม', year: 2026, title: 'วันแม่แห่งชาติ', description: 'วันคล้ายวันพระราชสมภพ สมเด็จพระบรมราชินีนาถในรัชกาลที่ 9' },
  { id: 'h-13', dayOfWeek: 'วันอังคาร', day: 13, month: 10, monthName: 'ตุลาคม', year: 2026, title: 'วันนวมินทรมหาราช', description: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระปรมินทรมหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร' },
  { id: 'h-14', dayOfWeek: 'วันศุกร์', day: 23, month: 10, monthName: 'ตุลาคม', year: 2026, title: 'วันปิยมหาราช' },
  { id: 'h-15', dayOfWeek: 'วันจันทร์', day: 7, month: 12, monthName: 'ธันวาคม', year: 2026, title: 'ชดเชยวันพ่อแห่งชาติ' },
  { id: 'h-16', dayOfWeek: 'วันพฤหัสบดี', day: 10, month: 12, monthName: 'ธันวาคม', year: 2026, title: 'วันรัฐธรรมนูญ' },
  { id: 'h-17', dayOfWeek: 'วันพฤหัสบดี', day: 31, month: 12, monthName: 'ธันวาคม', year: 2026, title: 'วันสิ้นปี' },
]

export default function HolidayWidget({
  width = 1,
  onResize,
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [filterMode, setFilterMode] = useState<'upcoming' | 'all'>('upcoming')

  // Calculate day difference relative to today
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const holidaysWithDiff = useMemo(() => {
    return THAI_HOLIDAYS_2026.map((h) => {
      const holidayDate = new Date(h.year, h.month - 1, h.day)
      holidayDate.setHours(0, 0, 0, 0)
      const diffTime = holidayDate.getTime() - today.getTime()
      const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24))
      return {
        ...h,
        dateObj: holidayDate,
        daysLeft,
        isPast: daysLeft < 0,
        isToday: daysLeft === 0,
        isUpcoming: daysLeft > 0,
      }
    })
  }, [today])

  // Next upcoming holiday
  const nextHoliday = useMemo(() => {
    return holidaysWithDiff.find((h) => h.daysLeft >= 0) || holidaysWithDiff[0]
  }, [holidaysWithDiff])

  // Filtered list
  const displayedHolidays = useMemo(() => {
    if (filterMode === 'upcoming') {
      const upcomingList = holidaysWithDiff.filter((h) => h.daysLeft >= 0)
      return upcomingList.length > 0 ? upcomingList : holidaysWithDiff
    }
    return holidaysWithDiff
  }, [filterMode, holidaysWithDiff])

  return (
    <section
      className="flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-black/[0.06] shadow-sm transition-all duration-200"
      aria-labelledby="holiday-widget-title"
    >
      <div>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600">
              <Palmtree size={20} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="holiday-widget-title"
                  className="text-[15px] font-bold tracking-tight text-slate-900"
                >
                  วันหยุดนักขัตฤกษ์
                </h2>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  ปี 2569
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                ปฏิทินวันหยุดราชการและวันหยุดตามประเพณี
              </p>
            </div>
          </div>

          {onResize && (
            <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />
          )}
        </div>

        {/* ── Upcoming Holiday Hero Card ───────────────────────────────── */}
        {nextHoliday && (
          <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-sky-500/10 p-4 ring-1 ring-emerald-500/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  <Clock size={12} />
                  <span>วันหยุดรอบถัดไป</span>
                </span>
                <h3 className="mt-1 text-base font-extrabold text-slate-900 sm:text-lg">
                  {nextHoliday.title}
                </h3>
                {nextHoliday.description && (
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-1">
                    {nextHoliday.description}
                  </p>
                )}
              </div>

              {/* Countdown badge */}
              <div className="shrink-0 text-right">
                {nextHoliday.isToday ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm animate-pulse">
                    <Sparkles size={12} />
                    <span>วันนี้เป็นวันหยุด!</span>
                  </span>
                ) : (
                  <div className="rounded-xl bg-white/90 px-3 py-1.5 text-center shadow-2xs ring-1 ring-black/[0.06]">
                    <span className="block text-[10px] font-semibold text-slate-500">เหลืออีก</span>
                    <span className="text-sm font-extrabold text-emerald-700 sm:text-base">
                      {nextHoliday.daysLeft} วัน
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Date bar */}
            <div className="mt-3 flex items-center gap-2 border-t border-emerald-500/15 pt-2 text-xs font-semibold text-slate-700">
              <span className="text-emerald-700">{nextHoliday.dayOfWeek}</span>
              <span className="text-slate-300">•</span>
              <span>
                {nextHoliday.day} {nextHoliday.monthName} {nextHoliday.year + 543}
              </span>
            </div>
          </div>
        )}

        {/* ── Filter Tabs ─────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div
            className="inline-flex rounded-full bg-slate-100 p-0.5 ring-1 ring-black/[0.04]"
            role="group"
            aria-label="ตัวกรองวันหยุด"
          >
            <button
              type="button"
              onClick={() => setFilterMode('upcoming')}
              aria-pressed={filterMode === 'upcoming'}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                filterMode === 'upcoming'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.06]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              กำลังจะมาถึง ({holidaysWithDiff.filter((h) => h.daysLeft >= 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              aria-pressed={filterMode === 'all'}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.06]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด (17 วัน)
            </button>
          </div>

          <span className="text-[11px] font-medium text-slate-400">
            {displayedHolidays.length} รายการ
          </span>
        </div>

        {/* ── Holiday List ────────────────────────────────────────────── */}
        <div
          className={`mt-3 divide-y divide-slate-100 overflow-y-auto ${
            width >= 3 ? 'max-h-72 grid grid-cols-1 md:grid-cols-2 gap-2 divide-y-0' : width >= 2 ? 'max-h-64' : 'max-h-48'
          }`}
        >
          {displayedHolidays.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 p-2.5 transition-colors rounded-xl ${
                item.id === nextHoliday?.id
                  ? 'bg-emerald-50/60 ring-1 ring-emerald-200/60'
                  : item.isPast
                  ? 'opacity-60 hover:bg-slate-50'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Date bubble */}
                <div
                  className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl font-bold text-center ${
                    item.id === nextHoliday?.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : item.isPast
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="text-[10px] leading-tight text-opacity-80">
                    {item.monthName.slice(0, 3)}
                  </span>
                  <span className="text-sm leading-tight">{item.day}</span>
                </div>

                {/* Holiday details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-slate-900">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {item.dayOfWeek} {item.day} {item.monthName}
                  </span>
                </div>
              </div>

              {/* Status indicator */}
              <div className="shrink-0 text-right">
                {item.isPast ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    <CheckCircle2 size={10} />
                    <span>ผ่านแล้ว</span>
                  </span>
                ) : item.isToday ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <span>วันนี้</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                    อีก {item.daysLeft} วัน
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span>ข้อมูลวันหยุดราชการประจำปี 2569</span>
        <span>รวมทั้งหมด 17 วัน</span>
      </footer>
    </section>
  )
}
