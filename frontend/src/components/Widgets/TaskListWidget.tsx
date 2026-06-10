'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Calendar, Clock, MapPin, RotateCw, Search, Tag, AlertCircle } from 'lucide-react'
import { pushNotifications } from '@/components/Layout/NotificationBell'

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
  onResize,
  selectedMonth,
}: {
  width?: number
  onResize?: (size: number) => void
  selectedMonth?: Date
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'imacd' | 'thanapong'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const currentMonth = selectedMonth || new Date()
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`

  // Google Calendar ID from environment variables or fallback
  const CALENDAR_ID = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || '935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com'

  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)

      const timeMin = startOfMonth.toISOString()
      const timeMax = endOfMonth.toISOString()

      // Use Next.js rewrite proxy (more reliable in Docker)
      const url = `/api/v1/calendar/events?calendar_id=${encodeURIComponent(CALENDAR_ID)}&time_min=${encodeURIComponent(timeMin)}&time_max=${encodeURIComponent(timeMax)}`
      
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 60000)
      let response: Response
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        const msg = detail?.detail || response.statusText
        throw new Error(`HTTP ${response.status}: ${msg}`)
      }

      const data = await response.json()
      setEvents(data)

      // Push today's tasks as calendar alerts
      const today = new Date()
      const todayStr = today.toDateString()
      const todayEvents = (data as any[]).filter(e => new Date(e.start).toDateString() === todayStr)
      if (todayEvents.length > 0) {
        pushNotifications([{
          id: 'calendar-today',
          type: 'calendar',
          level: 'info',
          title: `งานวันนี้ ${todayEvents.length} รายการ`,
          body: todayEvents.slice(0, 3).map((e: any) => e.title).join(', ') + (todayEvents.length > 3 ? ` และอีก ${todayEvents.length - 3} รายการ` : ''),
          at: new Date(),
        }])
      }
    } catch (err: any) {
      console.error('❌ Calendar API Error:', err)
      setError('ไม่สามารถโหลดข้อมูลปฏิทินได้')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  const hasIMACD = (e: CalendarEvent) => 
    e.title.toLowerCase().includes('imacd') || 
    (e.description?.toLowerCase().includes('imacd') ?? false)
  const hasThanapongTag = (e: CalendarEvent) => {
    const norm = (s: string) => s.normalize('NFC')
    const needle = norm('ธัญพงศ์')
    return norm(e.title).includes(needle) || norm(e.description ?? '').includes(needle)
  }
  const isTagged = (e: CalendarEvent) => hasIMACD(e) || hasThanapongTag(e)

  // Count tags in total events for the month
  const imacdTotalCount = events.filter(e => hasIMACD(e)).length
  const thanapongTotalCount = events.filter(e => hasThanapongTag(e)).length

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

  // Count categories
  const categoryCounts = events.reduce((acc, e) => {
    const { category } = parseEventTitle(e.title)
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Filter events based on filter state, category, and search query
  const filteredEvents = events.filter(event => {
    const tagged = isTagged(event)

    if (filter === 'imacd' && !hasIMACD(event)) return false
    if (filter === 'thanapong' && !hasThanapongTag(event)) return false

    if (categoryFilter !== 'all' && !tagged) {
      const { category } = parseEventTitle(event.title)
      if (category !== categoryFilter) return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const titleMatch = event.title.toLowerCase().includes(q)
      const descMatch = event.description?.toLowerCase().includes(q) || false
      const locMatch = event.location?.toLowerCase().includes(q) || false
      if (!titleMatch && !descMatch && !locMatch) return false
    }

    return true
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

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
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 border-b border-slate-100" role="group" aria-label="ตัวกรองงาน">
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

      {/* Category Filter Row */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-slate-100" role="group" aria-label="กรองตามประเภท">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
            categoryFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >ทุกประเภท</button>
        {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
          const catColors: Record<string, { active: string; inactive: string }> = {
            'DEMO': { active: 'bg-emerald-500 text-white', inactive: 'text-emerald-600 hover:bg-emerald-50' },
            'Installation': { active: 'bg-blue-500 text-white', inactive: 'text-blue-600 hover:bg-blue-50' },
            'Task': { active: 'bg-orange-500 text-white', inactive: 'text-orange-600 hover:bg-orange-50' },
            'Onsite Services': { active: 'bg-amber-500 text-white', inactive: 'text-amber-600 hover:bg-amber-50' },
            'Training': { active: 'bg-purple-500 text-white', inactive: 'text-purple-600 hover:bg-purple-50' },
          }
          const colors = catColors[cat] || { active: 'bg-slate-600 text-white', inactive: 'text-slate-500 hover:bg-slate-100' }
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                categoryFilter === cat ? colors.active : colors.inactive
              }`}
            >{cat}: {count}</button>
          )
        })}
      </div>

      {/* Task Grid Layout */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">ไม่พบรายการงาน</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: '600px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredEvents.map((event) => {
              const { category, details } = parseEventTitle(event.title)
              const hasIMACD_event = hasIMACD(event)
              const hasThanapong = hasThanapongTag(event)
              const startDate = new Date(event.start)
              const day = startDate.getDate()
              const monthShort = startDate.toLocaleDateString('th-TH', { month: 'short' })
              const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
              const endDate = new Date(event.end)
              const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

              let borderColor = 'border-l-slate-200'
              if (hasIMACD_event && hasThanapong) borderColor = 'border-l-purple-400'
              else if (hasIMACD_event) borderColor = 'border-l-red-500'
              else if (hasThanapong) borderColor = 'border-l-blue-500'

              // Category color map
              const categoryColors: Record<string, string> = {
                'DEMO': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                'Installation': 'bg-blue-100 text-blue-700 border-blue-200',
                'Task': 'bg-orange-100 text-orange-700 border-orange-200',
                'Onsite Services': 'bg-amber-100 text-amber-700 border-amber-200',
                'Training': 'bg-purple-100 text-purple-700 border-purple-200',
              }
              const catColor = categoryColors[category] || 'bg-slate-100 text-slate-600 border-slate-200'

              return (
                <div
                  key={event.id}
                  className={`rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:shadow-sm transition-all border-l-[3px] ${borderColor} p-3 flex flex-col gap-1.5`}
                >
                  {/* Date + Time */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-sky-600">{day} {monthShort}</span>
                    <span className="text-[11px] text-slate-400">{timeStr}-{endTimeStr}</span>
                  </div>

                  {/* Category Badge */}
                  <span className={`inline-block self-start px-2 py-0.5 text-[11px] font-bold rounded-md border ${catColor}`}>
                    {category}
                  </span>

                  {/* Details */}
                  <p className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-1">{details}</p>

                  {/* Full Description */}
                  {event.description && (
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-[11px] text-slate-600 leading-relaxed overflow-hidden">
                      <div
                        className="prose prose-xs max-w-none text-slate-600 [&_strong]:text-slate-800 [&_a]:text-blue-600 [&_a]:font-bold"
                        dangerouslySetInnerHTML={{
                          __html: event.description
                            .replace(/รายละเอียดของงาน:/g, '<strong>รายละเอียดของงาน:</strong>')
                            .replace(/วิธีการดำเนินงาน:/g, '<strong>วิธีการดำเนินงาน:</strong>')
                            .replace(/ผู้ให้บริการ\s*:/g, '<strong>ผู้ให้บริการ :</strong>')
                            .replace(/หมายเลขงาน\s*:/g, '<strong>หมายเลขงาน :</strong>')
                            .replace(/ผู้ดำเนินการ\s*:/g, '<strong>ผู้ดำเนินการ :</strong>')
                            .replace(/<a /gi, '<a class="text-blue-600 font-bold hover:underline" target="_blank" rel="noopener noreferrer" ')
                        }}
                      />
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex items-center gap-1 mt-auto pt-1">
                    {hasIMACD_event && <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded">IMACD</span>}
                    {hasThanapong && <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-blue-500 rounded">ธัญพงศ์</span>}
                    {event.location && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400 ml-auto truncate max-w-[80px]">
                        <MapPin size={9} />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
