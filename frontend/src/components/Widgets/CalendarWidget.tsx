'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'

export default function CalendarWidget({
  width = 3,
  onResize,
  selectedMonth,
  onMonthChange,
}: {
  width?: number
  onResize?: (size: number) => void
  selectedMonth?: Date
  onMonthChange?: (date: Date) => void
}) {
  const [internalDate, setInternalDate] = useState(new Date())
  const currentDate = selectedMonth || internalDate
  const setCurrentDate = (d: Date) => {
    setInternalDate(d)
    onMonthChange?.(d)
  }

  // Thai month names
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  // Google Calendar Embed URL with date parameter
  const getCalendarUrl = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const dateStr = `${year}${month.toString().padStart(2, '0')}01`

    const calendarId = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || '935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com'
    const src = encodeURIComponent(calendarId)
    // ใช้ "dates" เพื่อเปิดไปยังเดือนที่ต้องการ (ให้ start/end เหมือนกันก็ยังทำให้เปิดเดือนนั้นได้)
    return `https://calendar.google.com/calendar/embed?src=${src}&ctz=Asia%2FBangkok&mode=MONTH&dates=${dateStr}%2F${dateStr}`
  }

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Go to today
  const goToToday = () => {
    const now = new Date()
    setCurrentDate(now)
  }

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  return (
    <>
      <div className="premium-card fade-in h-full flex flex-col" role="region" aria-labelledby="calendar-title">
        {/* Header */}
        <div className={`widget-header ${
          width === 2 ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
        }`}>
          <div className="flex items-center justify-between w-full flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className={`widget-header-icon primary flex-shrink-0 ${
                width === 2 ? 'p-1.5' : 'p-2'
              }`}>
                <svg className={`${width === 2 ? 'w-5 h-5' : 'w-6 h-6'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
              </div>
              <div className="min-w-0">
                <h3 id="calendar-title" className={`font-semibold text-primary-700 ${
                  width === 2 ? 'text-base' : 'text-lg'
                }`}>
                  ปฏิทิน
                </h3>
                <p className={`text-neutral-500 ${
                  width === 2 ? 'text-xs' : 'text-sm'
                }`}>
                  {thaiMonths[currentMonth]} {currentYear + 543}
                </p>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <button
                onClick={previousMonth}
                aria-label="เดือนก่อนหน้า"
                title="เดือนก่อนหน้า"
                className="refresh-btn"
              >
                <ChevronLeft className={`${width === 2 ? 'w-4 h-4' : 'w-5 h-5'}`} aria-hidden="true" />
              </button>
              <button
                onClick={goToToday}
                aria-label="กลับไปเดือนปัจจุบัน"
                title="กลับไปเดือนปัจจุบัน"
                className={`art-primary-button !min-h-[40px] sm:!min-h-[44px] !px-3 sm:!px-4 text-xs sm:text-sm`}
              >
                วันนี้
              </button>
              <button
                onClick={nextMonth}
                aria-label="เดือนถัดไป"
                title="เดือนถัดไป"
                className="refresh-btn"
              >
                <ChevronRight className={`${width === 2 ? 'w-4 h-4' : 'w-5 h-5'}`} aria-hidden="true" />
              </button>

              {onResize && (
                <WidgetSizeToggle value={width} onChange={onResize} />
              )}
            </div>
          </div>
        </div>

        <div className="widget-body flex-1 flex flex-col p-0 overflow-hidden">
          {/* Google Calendar Embed */}
          <iframe
            key={getCalendarUrl()}
            src={getCalendarUrl()}
            style={{ border: 0, flex: 1, width: '100%', minHeight: '450px' }}
            frameBorder="0"
            scrolling="no"
            title="Google Calendar"
            className="rounded-b-xl"
            loading="lazy"
          ></iframe>
        </div>
      </div>
    </>
  )
}
