'use client'

import { useState, useEffect } from 'react'
import { Bell, Calendar, Clock, RotateCw, Search, Tag, AlertCircle, MapPin } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

export default function TaskListWidget({
  width = 3,
  onResize
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'imacd' | 'thanapong'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMonth] = useState(new Date())

  // Google Calendar ID from environment variables or fallback
  const CALENDAR_ID = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || '935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com'

  const fetchCalendarEvents = async () => {
    setLoading(true)
    setError(null)

    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59)

      const timeMin = startOfMonth.toISOString()
      const timeMax = endOfMonth.toISOString()

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const url = `${apiUrl}/api/v1/calendar/events?calendar_id=${encodeURIComponent(CALENDAR_ID)}&time_min=${encodeURIComponent(timeMin)}&time_max=${encodeURIComponent(timeMax)}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setEvents(data)
    } catch (err: any) {
      console.error('❌ Calendar API Error:', err)
      setError('ไม่สามารถโหลดข้อมูลปฏิทินได้')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarEvents()
  }, [currentMonth])

  // Count tags in total events for the month
  const imacdTotalCount = events.filter(e => e.title.toLowerCase().includes('imacd')).length
  const thanapongTotalCount = events.filter(e => e.title.includes('ธัญพงศ์')).length

  // Filter events based on filter state and search query
  const filteredEvents = events.filter(event => {
    if (filter === 'imacd' && !event.title.toLowerCase().includes('imacd')) return false
    if (filter === 'thanapong' && !event.title.includes('ธัญพงศ์')) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const titleMatch = event.title.toLowerCase().includes(q)
      const descMatch = event.description?.toLowerCase().includes(q) || false
      const locMatch = event.location?.toLowerCase().includes(q) || false
      if (!titleMatch && !descMatch && !locMatch) return false
    }

    return true
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // Parse title into Category and Details
  const parseEventTitle = (title: string) => {
    const colonIndex = title.indexOf(':')
    if (colonIndex !== -1) {
      const category = title.substring(0, colonIndex).trim()
      const details = title.substring(colonIndex + 1).trim()
      return { category, details }
    }
    if (title.toLowerCase().includes('installation')) return { category: 'Installation', details: title }
    if (title.toLowerCase().includes('demo')) return { category: 'DEMO', details: title }
    if (title.toLowerCase().includes('training')) return { category: 'Training', details: title }
    return { category: 'Task', details: title }
  }

  const formatDateDDMMYYYY = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const formatTimeRange = (startStr: string, endStr: string) => {
    const start = new Date(startStr)
    const end = new Date(endStr)
    const startH = String(start.getHours()).padStart(2, '0')
    const startM = String(start.getMinutes()).padStart(2, '0')
    const endH = String(end.getHours()).padStart(2, '0')
    const endM = String(end.getMinutes()).padStart(2, '0')
    return `${startH}:${startM} - ${endH}:${endM}`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-500 text-sm">กำลังโหลดข้อมูลจาก Google Calendar...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium mb-2">{error}</p>
          <button
            onClick={fetchCalendarEvents}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-semibold"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`premium-card fade-in flex flex-col h-full ${
      width === 2 ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
    }`} role="region" aria-label="งานของฉัน">
      {/* Top Header Layout */}
      <div className={`flex flex-col gap-3 border-b border-slate-100 pb-3 sm:pb-4 ${
        width > 1 ? 'lg:flex-row lg:items-center lg:justify-between lg:pb-6' : ''
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Circular pink bell background */}
          <div className={`flex items-center justify-center rounded-2xl bg-red-50 text-red-500 flex-shrink-0 ${
            width === 2 ? 'h-8 w-8' : 'h-10 sm:h-12 w-10 sm:w-12'
          }`}>
            <Bell size={width === 2 ? 14 : width === 2 ? 18 : 22} className="fill-red-500/10 text-red-500 animate-pulse-slow" />
          </div>
          <div className="min-w-0">
            <h2 className={`font-extrabold text-slate-900 tracking-tight ${
              width === 2 ? 'text-xs sm:text-sm' : 'text-sm sm:text-xl'
            }`}>
              รายการงาน ({filteredEvents.length})
            </h2>
            {width > 1 && (
              <p className={`font-semibold text-slate-400 mt-0.5 ${
                width === 2 ? 'text-[10px]' : 'text-xs'
              }`}>
                กรองจาก {events.length} รายการใน {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Right side controls: Search input, Refresh & Size buttons */}
        <div className={`flex flex-wrap items-center gap-2 ${
          width === 2 ? 'w-full' : 'justify-end'
        }`}>
          {/* Search Input */}
          <div className={`relative flex-1 ${
            width === 2 ? 'min-w-[120px]' : 'min-w-[150px]'
          }`}>
            <span className="absolute inset-y-0 left-2 sm:left-3 flex items-center text-slate-400">
              <Search size={width === 2 ? 12 : 14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหางาน..."
              className={`w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 border border-white/40 rounded-full bg-white/40 backdrop-blur-md shadow-glass-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-white/60 focus:bg-white/60 transition-all placeholder:text-slate-400 ${
                width === 2 ? 'text-xs' : 'text-xs sm:text-sm'
              }`}
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchCalendarEvents}
            className={`art-soft-button !rounded-full !py-1.5 sm:!py-2 !px-2 sm:!px-4 flex items-center gap-1 flex-shrink-0 ${
              width === 2 ? '!text-xs' : '!text-xs sm:!text-sm'
            }`}
            aria-label="รีเฟรชข้อมูลงาน"
          >
            <RotateCw size={width === 2 ? 12 : 14} />
            {width > 1 && <span>รีเฟรช</span>}
          </button>

          {/* Size Buttons */}
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

      {/* Filter Badges Layout */}
      <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2.5 py-3 sm:py-5 border-b border-slate-100 ${
        width === 2 ? 'mb-2' : 'mb-4'
      }`} role="group" aria-label="ตัวกรองงาน">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold transition-all ${
            filter === 'all'
              ? 'bg-slate-800 text-white shadow-glass-sm'
              : 'bg-white/50 border border-white/40 backdrop-blur-md text-slate-600 hover:bg-white/80 hover:text-slate-700'
          }`}
        >
          ทั้งหมด
        </button>
        <button
          onClick={() => setFilter('imacd')}
          className={`flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold transition-all border ${
            filter === 'imacd'
              ? 'bg-red-500 border-red-400 text-white shadow-glass-sm'
              : 'bg-red-50/60 backdrop-blur-md border-red-200 text-red-600 hover:bg-red-100/80'
          }`}
        >
          <Tag size={width === 2 ? 10 : 12} className="fill-current flex-shrink-0" />
          {width > 1 && <span>IMACD: {imacdTotalCount}</span>}
          {width === 2 && <span>{imacdTotalCount}</span>}
        </button>
        <button
          onClick={() => setFilter('thanapong')}
          className={`flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold transition-all border ${
            filter === 'thanapong'
              ? 'bg-blue-500 border-blue-400 text-white shadow-glass-sm'
              : 'bg-blue-50/60 backdrop-blur-md border-blue-200 text-blue-600 hover:bg-blue-100/80'
          }`}
        >
          <Tag size={width === 2 ? 10 : 12} className="fill-current flex-shrink-0" />
          {width > 1 && <span>ธัญพงศ์: {thanapongTotalCount}</span>}
          {width === 2 && <span>{thanapongTotalCount}</span>}
        </button>
      </div>

      {/* Task Grid Box Layout */}
      {filteredEvents.length === 0 ? (
        <div className={`text-center py-10 sm:py-20 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50 ${
          width === 2 ? 'mt-4' : 'mt-6'
        }`}>
          <Calendar className={`text-slate-300 mx-auto mb-2 sm:mb-3 ${
            width === 2 ? 'h-8 w-8' : 'h-12 w-12'
          }`} />
          <p className={`font-semibold text-slate-500 ${
            width === 2 ? 'text-xs' : 'text-sm'
          }`}>ไม่พบรายการงานที่ค้นหา</p>
          <p className={`text-slate-400 mt-1 ${
            width === 2 ? 'text-[10px]' : 'text-xs'
          }`}>ลองเปลี่ยนคำค้นหาหรือตัวกรองอื่น</p>
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto pr-2 space-y-2 sm:space-y-4 ${
          width === 2 ? 'max-h-[300px]' : 'max-h-[380px] sm:max-h-[450px]'
        }`}>
          {filteredEvents.map((event) => {
            const { category } = parseEventTitle(event.title)
            const hasIMACD = event.title.toLowerCase().includes('imacd')
            const hasThanapong = event.title.includes('ธัญพงศ์')

            let indicatorClass = 'absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl'
            let indicatorStyle = {}

            if (hasIMACD && hasThanapong) {
              indicatorStyle = {
                background: 'linear-gradient(to bottom, #ef4444 0%, #ef4444 50%, #3b82f6 50%, #3b82f6 100%)'
              }
            } else if (hasIMACD) {
              indicatorClass += ' bg-red-500'
            } else if (hasThanapong) {
              indicatorClass += ' bg-blue-500'
            } else {
              indicatorClass += ' bg-slate-200'
            }

            return (
              <div
                key={event.id}
                className={`relative glass-panel hover:shadow-glass hover:-translate-y-1 rounded-2xl p-4 sm:p-6 pl-6 sm:pl-7 transition-all duration-300 group flex flex-col justify-between ${
                  width === 2 ? 'p-3 pl-5' : ''
                }`}
              >
                {/* Left vertical border indicator */}
                <div className={indicatorClass} style={indicatorStyle} aria-hidden="true" />

                <div>
                  {/* Top card metadata: Category & Badges */}
                  <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-3.5">
                    <span className={`font-extrabold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1 ${
                      width === 2 ? 'text-sm' : 'text-base'
                    }`}>
                      {category}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {hasIMACD && (
                        <span className={`px-2 text-white rounded-md font-extrabold uppercase tracking-wide bg-red-500 ${
                          width === 2 ? 'py-0.5 text-[8px]' : 'py-0.5 text-[9px]'
                        }`}>
                          IMACD
                        </span>
                      )}
                      {hasThanapong && (
                        <span className={`px-2 text-white rounded-md font-extrabold uppercase tracking-wide bg-blue-500 ${
                          width === 2 ? 'py-0.5 text-[8px]' : 'py-0.5 text-[9px]'
                        }`}>
                          ธัญพงศ์
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date & Time Row */}
                  <div className={`flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-1 font-bold text-slate-500 mb-2 sm:mb-4 bg-slate-50 border border-slate-100 py-1 sm:py-1.5 px-2 sm:px-3 rounded-xl w-fit ${
                    width === 2 ? 'text-[10px]' : 'text-xs'
                  }`}>
                    <Calendar size={width === 2 ? 11 : 13} className="text-blue-500 flex-shrink-0" />
                    <span>{formatDateDDMMYYYY(event.start)}</span>
                    <span className="text-slate-300">|</span>
                    <Clock size={width === 2 ? 11 : 13} className="text-blue-500 flex-shrink-0" />
                    <span>{formatTimeRange(event.start, event.end)}</span>
                  </div>

                  {/* Details box inside card */}
                  {event.description && (
                    <div className={`bg-[#f8fafc]/60 border border-slate-100/80 rounded-xl p-3 sm:p-4 text-slate-600 font-medium leading-relaxed mb-1 whitespace-pre-line break-words border-l-2 border-l-slate-200 ${
                      width === 2 ? 'text-[11px]' : 'text-[13px]'
                    }`}>
                      <div 
                        className="prose prose-sm max-w-none text-slate-600"
                        dangerouslySetInnerHTML={{ 
                          __html: event.description
                            .replace(/รายละเอียดของงาน:/g, '<strong class="text-slate-800">รายละเอียดของงาน:</strong>')
                            .replace(/วิธีการดำเนินงาน:/g, '<strong class="text-slate-800">วิธีการดำเนินงาน:</strong>')
                            .replace(/ผู้ให้บริการ\s*:/g, '<strong class="text-slate-800">ผู้ให้บริการ :</strong>')
                            .replace(/หมายเลขงาน\s*:/g, '<strong class="text-slate-800">หมายเลขงาน :</strong>')
                            .replace(/ผู้ดำเนินการ\s*:/g, '<strong class="text-slate-800">ผู้ดำเนินการ :</strong>')
                            .replace(/<a /gi, '<a class="text-blue-600 font-bold hover:underline" target="_blank" rel="noopener noreferrer" ')
                        }} 
                      />
                    </div>
                  )}
                </div>

                {/* Location metadata (if available) */}
                {event.location && (
                  <div className={`flex items-center gap-1 sm:gap-1.5 text-slate-400 mt-2 sm:mt-4 border-t border-slate-100 pt-2 sm:pt-3 font-semibold ${
                    width === 2 ? 'text-[10px]' : 'text-xs'
                  }`}>
                    <MapPin size={width === 2 ? 10 : 12} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
