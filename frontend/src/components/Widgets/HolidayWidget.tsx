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
import { HolidayItem, getHolidaysWithDiff } from '@/utils/holidays'

export type { HolidayItem }

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
    return getHolidaysWithDiff(today)
  }, [today])
  const calendarYear = today.getFullYear()
  const hasCalendar = holidaysWithDiff.length > 0

  // Next upcoming holiday
  const nextHoliday = useMemo(() => {
    return holidaysWithDiff.find((h) => h.daysLeft >= 0) || holidaysWithDiff[0]
  }, [holidaysWithDiff])

  // Filtered list
  const displayedHolidays = useMemo(() => {
    let result = holidaysWithDiff
    if (filterMode === 'upcoming') {
      const upcomingList = holidaysWithDiff.filter((h) => h.daysLeft >= 0)
      result = upcomingList.length > 0 ? upcomingList : holidaysWithDiff
    }
    
    // Limit to 3 upcoming when widget is small (width 1)
    if (width === 1 && filterMode === 'upcoming') {
      return result.slice(0, 3)
    }
    
    return result
  }, [filterMode, holidaysWithDiff, width])

  return (
    <section
      className="flex h-full flex-col justify-between rounded-[24px] bg-white p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-200"
      aria-labelledby="holiday-widget-title"
    >
      <div>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Icon badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#0071e3]/10 text-[#0071e3]">
              <Palmtree size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="holiday-widget-title"
                  className="text-[16px] font-bold tracking-tight text-[#1d1d1f] truncate"
                >
                  วันหยุดนักขัตฤกษ์
                </h2>
                <span className="shrink-0 rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[11px] font-bold text-[#6e6e73]">
                  {hasCalendar ? `ปี ${calendarYear + 543}` : 'ยังไม่พร้อม'}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[#86868b] truncate">
                ปฏิทินวันหยุดราชการและวันหยุดตามประเพณี
              </p>
            </div>
          </div>

          {onResize && (
            <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />
          )}
        </div>

        {!hasCalendar && (
          <div className="mt-4 rounded-[18px] border border-dashed border-[#0071e3]/30 bg-[#0071e3]/5 p-4 text-center">
            <CalendarHeart className="mx-auto text-[#0071e3]" size={22} aria-hidden="true" />
            <p className="mt-2 text-[13px] font-bold text-[#1d1d1f]">ยังไม่มีปฏิทินวันหยุดปี {calendarYear + 543}</p>
            <p className="mt-1 text-[11px] text-[#86868b]">จะแสดงข้อมูลเมื่อเพิ่มปฏิทินที่ยืนยันแล้ว</p>
          </div>
        )}

        {/* ── Upcoming Holiday Hero Card ───────────────────────────────── */}
        {nextHoliday && (
          <div className="mt-4 overflow-hidden rounded-[18px] bg-[#0071e3] p-4 text-white shadow-[0_8px_24px_rgba(0,113,227,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  <Clock size={12} />
                  <span>วันหยุดรอบถัดไป</span>
                </span>
                <h3 className="mt-1.5 text-[17px] font-bold leading-tight sm:text-[19px] truncate">
                  {nextHoliday.title}
                </h3>
                {nextHoliday.description && (
                  <p className="mt-0.5 text-[12px] text-white/80 truncate">
                    {nextHoliday.description}
                  </p>
                )}
              </div>

              {/* Countdown badge */}
              <div className="shrink-0 text-right">
                {nextHoliday.isToday ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0071e3] shadow-sm animate-pulse">
                    <Sparkles size={12} />
                    <span>วันนี้เป็นวันหยุด!</span>
                  </span>
                ) : (
                  <div className="flex min-w-[56px] flex-col items-center justify-center rounded-[14px] bg-white/15 px-3 py-1.5 backdrop-blur-md border border-white/20">
                    <span className="text-[10px] font-medium text-white/80">เหลืออีก</span>
                    <span className="text-[18px] font-extrabold leading-tight">
                      {nextHoliday.daysLeft}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Date bar */}
            <div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3 text-[13px] font-medium">
              <CalendarDays size={14} className="opacity-80" />
              <span>
                {nextHoliday.dayOfWeek}, {nextHoliday.day} {nextHoliday.monthName} {nextHoliday.year + 543}
              </span>
            </div>
          </div>
        )}

        {/* ── Filter Tabs ─────────────────────────────────────────────── */}
        <div className={`mt-4 flex items-center justify-between gap-2 ${hasCalendar ? '' : 'hidden'}`}>
          <div
            className="inline-flex rounded-full bg-[#e5e5ea] p-0.5"
            role="group"
            aria-label="ตัวกรองวันหยุด"
          >
            <button
              type="button"
              onClick={() => setFilterMode('upcoming')}
              aria-pressed={filterMode === 'upcoming'}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-150 ${
                filterMode === 'upcoming'
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              กำลังจะมาถึง ({holidaysWithDiff.filter((h) => h.daysLeft >= 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              aria-pressed={filterMode === 'all'}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-150 ${
                filterMode === 'all'
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              ทั้งหมด ({holidaysWithDiff.length} วัน)
            </button>
          </div>

          <span className="text-[11px] font-medium text-[#86868b]">
            {displayedHolidays.length} รายการ
          </span>
        </div>

        {/* ── Holiday List ────────────────────────────────────────────── */}
        <div
          className={`mt-3 divide-y divide-black/[0.04] overflow-y-auto ${hasCalendar ? '' : 'hidden'} ${
            width >= 3 ? 'max-h-72 grid grid-cols-1 md:grid-cols-2 gap-2 divide-y-0' : width >= 2 ? 'max-h-64' : 'max-h-48'
          }`}
        >
          {displayedHolidays.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center justify-between gap-3 p-2.5 transition-all rounded-[14px] ${
                item.id === nextHoliday?.id
                  ? 'bg-blue-50/50 ring-1 ring-blue-100'
                  : item.isPast
                  ? 'opacity-60 hover:bg-gray-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Date bubble */}
                <div
                  className={`flex h-[42px] w-[42px] shrink-0 flex-col items-center justify-center rounded-[12px] font-bold text-center transition-colors ${
                    item.id === nextHoliday?.id
                      ? 'bg-[#0071e3] text-white shadow-md shadow-blue-500/20'
                      : item.isPast
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-gray-100/80 text-gray-800 group-hover:bg-gray-200/60'
                  }`}
                >
                  <span className="text-[10px] leading-none opacity-90 mb-0.5 uppercase tracking-wider">
                    {item.monthName.slice(0, 3)}
                  </span>
                  <span className="text-[14px] leading-none">{item.day}</span>
                </div>

                {/* Holiday details */}
                <div className="min-w-0">
                  <p className={`truncate text-[13px] font-semibold ${item.id === nextHoliday?.id ? 'text-[#0071e3]' : 'text-gray-900'}`}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {item.dayOfWeek}, {item.day} {item.monthName}
                  </p>
                </div>
              </div>

              {/* Status indicator */}
              <div className="shrink-0 text-right">
                {item.isPast ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-500">
                    <CheckCircle2 size={12} />
                    <span>ผ่านแล้ว</span>
                  </span>
                ) : item.isToday ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-700">
                    <Sparkles size={12} />
                    <span>วันนี้</span>
                  </span>
                ) : (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    item.id === nextHoliday?.id 
                      ? 'bg-blue-100/80 text-[#0071e3]' 
                      : 'bg-gray-100/80 text-gray-600'
                  }`}>
                    อีก {item.daysLeft} วัน
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-2.5 text-[11px] text-[#86868b]">
        <span>{hasCalendar ? `ข้อมูลวันหยุดราชการประจำปี ${calendarYear + 543}` : 'รออัปเดตปฏิทินที่ยืนยันแล้ว'}</span>
        <span>{hasCalendar ? `รวมทั้งหมด ${holidaysWithDiff.length} วัน` : ''}</span>
      </footer>
    </section>
  )
}
