'use client'

import { useState } from 'react'

export default function CalendarWidget({
  width = 1,
  onResize
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [currentDate, setCurrentDate] = useState(new Date())

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
    
    return `https://calendar.google.com/calendar/embed?src=935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626%40group.calendar.google.com&ctz=Asia%2FBangkok&mode=MONTH&dates=${dateStr}%2F${dateStr}`
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
    setCurrentDate(new Date())
  }

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  return (
    <>
      <div className="premium-card fade-in h-full flex flex-col" role="region" aria-labelledby="calendar-title">
        {/* Header */}
        <div className="widget-header">
          <div className="flex items-center justify-between w-full flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="widget-header-icon primary animate-pulse-slow">
                <i className="bi bi-calendar-event text-xl" aria-hidden="true"></i>
              </div>
              <div>
                <h3 id="calendar-title" className="text-lg font-semibold text-primary-700">
                  ปฏิทิน
                </h3>
                <p className="text-sm text-neutral-500">
                  {thaiMonths[currentMonth]} {currentYear + 543}
                </p>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={previousMonth}
                aria-label="เดือนก่อนหน้า"
                title="เดือนก่อนหน้า"
                className="refresh-btn"
              >
                <i className="bi bi-chevron-left text-lg" aria-hidden="true"></i>
              </button>
              <button
                onClick={goToToday}
                aria-label={`กลับไปยัง ${thaiMonths[currentMonth]}`}
                title="กลับไปเดือนปัจจุบัน"
                className="art-primary-button !min-h-[44px] !px-4"
              >
                {thaiMonths[currentMonth]}
              </button>
              <button
                onClick={nextMonth}
                aria-label="เดือนถัดไป"
                title="เดือนถัดไป"
                className="refresh-btn"
              >
                <i className="bi bi-chevron-right text-lg" aria-hidden="true"></i>
              </button>

              {onResize && (
                <div className="flex items-center h-11 rounded-full bg-white/20 border border-white/20 p-1 gap-1 ml-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
                  {[2, 3].map((size) => (
                    <button
                      key={size}
                      onClick={() => onResize(size)}
                      className={`flex items-center justify-center w-9 h-9 rounded-full text-[11px] font-extrabold transition-all duration-200 ${
                        width === size
                          ? 'bg-white text-sky-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                      }`}
                      title={`${size === 2 ? 'กลาง (2/3)' : 'ใหญ่ (เต็ม)'}`}
                      aria-label={`ปรับขนาดเป็น ${size === 2 ? 'กลาง' : 'ใหญ่'}`}
                    >
                      {size === 2 ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="widget-body flex-1 flex flex-col p-0" style={{ minHeight: '400px' }}>
          {/* Google Calendar Embed */}
          <iframe
            key={getCalendarUrl()}
            src={getCalendarUrl()}
            style={{ border: 0 }}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            title="Google Calendar"
            className="rounded-b-xl"
          ></iframe>
        </div>
      </div>
    </>
  )
}
