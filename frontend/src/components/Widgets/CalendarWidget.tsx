'use client'

import { useState } from 'react'

export default function CalendarWidget({
  width = 3,
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
        <div className={`widget-header ${
          width === 2 ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
        }`}>
          <div className="flex items-center justify-between w-full flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className={`widget-header-icon primary animate-pulse-slow flex-shrink-0 ${
                width === 2 ? 'p-1.5' : 'p-2'
              }`}>
                <i className={`bi bi-calendar-event ${
                  width === 2 ? 'text-lg' : 'text-xl'
                }`} aria-hidden="true"></i>
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
                <i className={`bi bi-chevron-left ${
                  width === 2 ? 'text-base' : 'text-lg'
                }`} aria-hidden="true"></i>
              </button>
              <button
                onClick={goToToday}
                aria-label={`กลับไปยัง ${thaiMonths[currentMonth]}`}
                title="กลับไปเดือนปัจจุบัน"
                className={`art-primary-button !min-h-[40px] sm:!min-h-[44px] !px-3 sm:!px-4 text-xs sm:text-sm`}
              >
                {thaiMonths[currentMonth]}
              </button>
              <button
                onClick={nextMonth}
                aria-label="เดือนถัดไป"
                title="เดือนถัดไป"
                className="refresh-btn"
              >
                <i className={`bi bi-chevron-right ${
                  width === 2 ? 'text-base' : 'text-lg'
                }`} aria-hidden="true"></i>
              </button>

              {onResize && (
                <div style={{
                  position: 'relative',
                  display: 'inline-flex',
                  width: 'fit-content',
                  minHeight: '44px',
                  alignItems: 'center',
                  gap: '11px',
                  borderRadius: '999px',
                  border: '1.5px solid rgba(203, 213, 225, 0.5)',
                  background: 'rgba(248, 250, 252, 0.85)',
                  backdropFilter: 'blur(8px) saturate(180%)',
                  padding: '7px 16px 7px 8px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                  {[2, 3].map((size) => (
                    <button
                      key={size}
                      onClick={() => onResize(size)}
                      className={`relative flex items-center justify-center rounded-full text-xs font-extrabold transition-all duration-250 min-w-0 min-h-0 ${
                        width === size
                          ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                      style={{
                        padding: '6px 14px',
                        minWidth: '32px',
                        height: '28px',
                      }}
                      title={`${size === 2 ? 'กลาง (M)' : 'ใหญ่ (L)'}`}
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

        <div className="widget-body flex-1 flex flex-col p-0 overflow-hidden" style={{ minHeight: width === 2 ? '300px' : '400px' }}>
          {/* Google Calendar Embed */}
          <iframe
            key={getCalendarUrl()}
            src={getCalendarUrl()}
            style={{ border: 0, flex: 1, width: '100%' }}
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
