'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

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

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState<number | null>(null)

  // Thai month names
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  const fetchMonthEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const startOfMonth = new Date(year, month, 1).toISOString()
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString()

      const url = `/api/v1/calendar/events?calendar_id=sharepoint&time_min=${encodeURIComponent(startOfMonth)}&time_max=${encodeURIComponent(endOfMonth)}`
      const res = await fetchWithAuth(url)
      if (!res.ok) {
        throw new Error('ไม่สามารถเชื่อมต่อระบบตารางงานได้')
      }
      const data = await res.json()
      setEvents(data)
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดตารางงาน')
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchMonthEvents()
  }, [fetchMonthEvents])

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setActiveDay(null)
  }

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setActiveDay(null)
  }

  // Go to today
  const goToToday = () => {
    const now = new Date()
    setCurrentDate(now)
    setActiveDay(now.getDate())
  }

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  // Generate calendar grid days
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()

    const days = []
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null) // padding days
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i)
    }
    return days
  }

  const calendarDays = getDaysInMonth()

  // Get events on a specific day
  const getDayEvents = (day: number) => {
    return events.filter(e => {
      const eDate = new Date(e.start)
      return eDate.getDate() === day && eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear
    })
  }

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
                <Calendar className={`${width === 2 ? 'w-5 h-5' : 'w-6 h-6'}`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="calendar-title" className={`font-semibold text-primary-700 ${
                  width === 2 ? 'text-base' : 'text-lg'
                }`}>
                  ปฏิทินงาน SharePoint
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
                className="art-icon-button"
              >
                <ChevronLeft className={`${width === 2 ? 'w-4 h-4' : 'w-5 h-5'}`} aria-hidden="true" />
              </button>
              <button
                onClick={goToToday}
                aria-label="กลับไปเดือนปัจจุบัน"
                title="กลับไปเดือนปัจจุบัน"
                className="art-primary-button !min-h-11 !px-4 !py-2 text-sm"
              >
                วันนี้
              </button>
              <button
                onClick={nextMonth}
                aria-label="เดือนถัดไป"
                title="เดือนถัดไป"
                className="art-icon-button"
              >
                <ChevronRight className={`${width === 2 ? 'w-4 h-4' : 'w-5 h-5'}`} aria-hidden="true" />
              </button>

              {onResize && (
                <WidgetSizeToggle value={width} onChange={onResize} />
              )}
            </div>
          </div>
        </div>

        <div className="widget-body flex-1 flex flex-col p-4 overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-2"></div>
              <span className="text-sm text-neutral-500">กำลังโหลดปฏิทินจาก SharePoint...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-8 h-8 mb-2" />
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center font-medium text-xs sm:text-sm text-neutral-700 bg-neutral-50 p-2 rounded-xl">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                  <div key={day} className="py-1 font-bold text-neutral-500">{day}</div>
                ))}
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="p-2 sm:p-3" />
                  }

                  const dayEvents = getDayEvents(day)
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear
                  const isActive = activeDay === day

                  return (
                    <button
                      key={day}
                      onClick={() => setActiveDay(isActive ? null : day)}
                      className={`relative p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center transition-all ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-md font-bold'
                          : isToday
                          ? 'bg-primary-50 text-primary-700 font-bold border border-primary-300'
                          : 'hover:bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      <span className="text-sm">{day}</span>
                      {dayEvents.length > 0 && (
                        <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-primary-500'}`} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Day Events Details Panel */}
              {activeDay !== null && (
                <div className="bg-primary-50 border border-primary-100 p-4 rounded-xl flex flex-col gap-2">
                  <h4 className="font-bold text-primary-800 text-sm">
                    งานสำหรับวันที่ {activeDay} {thaiMonths[currentMonth]}
                  </h4>
                  {getDayEvents(activeDay).length === 0 ? (
                    <p className="text-neutral-500 text-xs">ไม่มีงานที่จองไว้</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      {getDayEvents(activeDay).map(event => (
                        <div key={event.id} className="bg-white p-2.5 rounded-lg border border-primary-200 shadow-sm">
                          <p className="font-semibold text-neutral-800 text-xs sm:text-sm">{event.title}</p>
                          {event.location && (
                            <p className="text-neutral-500 text-xxs sm:text-xs mt-0.5">📍 {event.location}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
