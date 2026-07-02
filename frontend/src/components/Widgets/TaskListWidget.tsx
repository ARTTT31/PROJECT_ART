'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Bell, Calendar, Clock, MapPin, RotateCw, Search, Tag, AlertCircle } from 'lucide-react'
import { pushNotifications } from '@/components/Layout/NotificationBell'
import WidgetSizeToggle from './WidgetSizeToggle'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import DOMPurify from 'dompurify'

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
  const abortRef = useRef<AbortController | null>(null)
  const [cacheNote, setCacheNote] = useState<string | null>(null)

  // SharePoint List settings
  const CALENDAR_ID = 'sharepoint'

  const CACHE_KEY = useMemo(() => `artTaskListCacheV1:${CALENDAR_ID}:${monthKey}`, [CALENDAR_ID, monthKey])
  const CACHE_TTL_MS = 15 * 60_000 // 15 นาที

  const fetchCalendarEvents = useCallback(async () => {
    // cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const [yearStr, monthStr] = monthKey.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr) // 0-based
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)

      const timeMin = startOfMonth.toISOString()
      const timeMax = endOfMonth.toISOString()

      // Call backend API directly via fetchWithAuth
      const url = `/api/v1/calendar/events?calendar_id=${encodeURIComponent(CALENDAR_ID)}&time_min=${encodeURIComponent(timeMin)}&time_max=${encodeURIComponent(timeMax)}`

      const response = await fetchWithAuth(url, { signal: controller.signal })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        const msg = detail?.detail || response.statusText
        
        // Provide user-friendly Thai error messages based on status code
        let userMessage = 'ไม่สามารถโหลดข้อมูลตารางงานได้'
        
        if (response.status === 404) {
          userMessage = 'ไม่พบตารางงาน - กรุณาตรวจสอบการตั้งค่า SharePoint List'
          console.error('📅 SharePoint List not found. Error:', msg)
        } else if (response.status === 403) {
          userMessage = 'ไม่สามารถเข้าถึงตารางงานได้ - กรุณาตรวจสอบสิทธิ์การใช้งาน Microsoft Graph'
          console.error('🔒 SharePoint access denied. Error:', msg)
        } else if (response.status === 502 || response.status === 504) {
          userMessage = 'เชื่อมต่อบริการ Microsoft Graph ไม่สำเร็จ - กรุณาลองใหม่อีกครั้ง'
          console.error('🌐 SharePoint service error. Error:', msg)
        } else {
          console.error('❌ SharePoint API Error:', msg)
        }
        
        throw new Error(`HTTP ${response.status}: ${msg}`, { cause: userMessage })
      }

      const data = await response.json()
      setEvents(data)
      setCacheNote(null)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events: data }))
      } catch {
        // ignore
      }

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
      if (err?.name === 'AbortError') return
      console.error('❌ Calendar API Error:', err)
      
      // Use custom error message if available, otherwise use generic message
      const errorMessage = err?.cause || 'ไม่สามารถโหลดข้อมูลปฏิทินได้'
      setError(errorMessage)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [CACHE_KEY, CALENDAR_ID, monthKey])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  useEffect(() => {
    // hydrate from cache when month changes (ลดจอว่าง)
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return
      const cached = JSON.parse(raw) as { savedAt: number; events: CalendarEvent[] }
      if (!cached?.savedAt || !Array.isArray(cached.events)) return
      if (Date.now() - cached.savedAt > CACHE_TTL_MS) return
      setEvents(cached.events)
      setCacheNote('แสดงข้อมูลจากแคช')
      setLoading(false)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CACHE_KEY])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

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
  }).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())

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

  const sanitizeDescription = useCallback((html: string) => {
    const withHighlights = html
      .replace(/รายละเอียดของงาน:/g, '<strong>รายละเอียดของงาน:</strong>')
      .replace(/วิธีการดำเนินงาน:/g, '<strong>วิธีการดำเนินงาน:</strong>')
      .replace(/ผู้ให้บริการ\s*:/g, '<strong>ผู้ให้บริการ :</strong>')
      .replace(/หมายเลขงาน\s*:/g, '<strong>หมายเลขงาน :</strong>')
      .replace(/ผู้ดำเนินการ\s*:/g, '<strong>ผู้ดำเนินการ :</strong>')
      // force links to open safely
      .replace(/<a /gi, '<a class="text-blue-600 font-bold hover:underline" target="_blank" rel="noopener noreferrer" ')

    return DOMPurify.sanitize(withHighlights, { USE_PROFILES: { html: true } })
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-500 text-sm">กำลังโหลดข้อมูลจาก SharePoint List...</p>
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
            className="art-primary-button !min-h-10 !px-4 !py-2 !text-sm"
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
            {cacheNote && width > 1 && (
              <p className={`font-semibold text-slate-400 mt-0.5 ${width === 2 ? 'text-[10px]' : 'text-xs'}`}>
                {cacheNote}
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
            className={`art-soft-button !min-h-10 !py-2 !px-3 sm:!px-4 flex-shrink-0 ${
              width === 2 ? '!text-xs' : '!text-xs sm:!text-sm'
            }`}
            aria-label="รีเฟรชข้อมูลงาน"
          >
            <RotateCw size={width === 2 ? 12 : 14} />
            {width > 1 && <span>รีเฟรช</span>}
          </button>

          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[2, 3]} />}
        </div>
      </div>

      {/* Filter Badges Layout */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 border-b border-slate-100" role="group" aria-label="ตัวกรองงาน">
        <button
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={`art-chip-button px-2 sm:px-4 ${
            filter === 'all'
              ? 'is-active'
              : ''
          }`}
        >
          ทั้งหมด
        </button>
        <button
          onClick={() => setFilter('imacd')}
          aria-pressed={filter === 'imacd'}
          className={`art-chip-button px-2 sm:px-4 ${
            filter === 'imacd'
              ? 'is-active !border-red-500 !bg-red-500'
              : '!border-red-200 !bg-red-50/70 !text-red-700 hover:!bg-red-100'
          }`}
        >
          <Tag size={width === 2 ? 10 : 12} className="fill-current flex-shrink-0" />
          {width > 1 && <span>IMACD: {imacdTotalCount}</span>}
          {width === 2 && <span>{imacdTotalCount}</span>}
        </button>
        <button
          onClick={() => setFilter('thanapong')}
          aria-pressed={filter === 'thanapong'}
          className={`art-chip-button px-2 sm:px-4 ${
            filter === 'thanapong'
              ? 'is-active !border-blue-500 !bg-blue-500'
              : '!border-blue-200 !bg-blue-50/70 !text-blue-700 hover:!bg-blue-100'
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
          aria-pressed={categoryFilter === 'all'}
          className={`art-chip-button !min-h-7 !rounded-lg !px-2.5 !py-1 !text-[11px] ${
            categoryFilter === 'all' ? 'is-active' : 'border-transparent bg-transparent shadow-none'
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
              aria-pressed={categoryFilter === cat}
              className={`art-chip-button !min-h-7 !rounded-lg !px-2.5 !py-1 !text-[11px] ${
                categoryFilter === cat ? colors.active : `border-transparent bg-transparent shadow-none ${colors.inactive}`
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
                          __html: sanitizeDescription(event.description),
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
