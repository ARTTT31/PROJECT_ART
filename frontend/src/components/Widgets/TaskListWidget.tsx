'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AlertCircle, Bell, Calendar, MapPin, RotateCw, Search, Tag } from 'lucide-react'
import { pushNotifications } from '@/components/Layout/NotificationBell'
import WidgetSizeToggle from './WidgetSizeToggle'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import DOMPurify from 'dompurify'

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskListWidget({
  width = 3,
  onResize,
  selectedMonth,
}: {
  width?: number
  onResize?: (size: number) => void
  selectedMonth?: Date
}) {
  const [events, setEvents]           = useState<CalendarEvent[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [filter, setFilter]           = useState<'all' | 'imacd' | 'thanapong'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cacheNote, setCacheNote]     = useState<string | null>(null)

  const currentMonth = selectedMonth || new Date()
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`
  const abortRef = useRef<AbortController | null>(null)

  const CALENDAR_ID = 'sharepoint'
  const CACHE_KEY   = useMemo(() => `artTaskListCacheV1:${CALENDAR_ID}:${monthKey}`, [CALENDAR_ID, monthKey])
  const CACHE_TTL_MS = 15 * 60_000

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchCalendarEvents = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const [yearStr, monthStr] = monthKey.split('-')
      const year  = Number(yearStr)
      const month = Number(monthStr)
      const timeMin = new Date(year, month, 1).toISOString()
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString()
      const url = `/api/v1/calendar/events?calendar_id=${encodeURIComponent(CALENDAR_ID)}&time_min=${encodeURIComponent(timeMin)}&time_max=${encodeURIComponent(timeMax)}`

      const response = await fetchWithAuth(url, { signal: controller.signal })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        const msg = detail?.detail || response.statusText
        let userMessage = 'ไม่สามารถโหลดข้อมูลตารางงานได้'
        if (response.status === 404)                        userMessage = 'ไม่พบตารางงาน — กรุณาตรวจสอบการตั้งค่า SharePoint List'
        else if (response.status === 403)                   userMessage = 'ไม่สามารถเข้าถึงตารางงานได้ — กรุณาตรวจสอบสิทธิ์ Microsoft Graph'
        else if (response.status === 502 || response.status === 504) userMessage = 'เชื่อมต่อบริการ Microsoft Graph ไม่สำเร็จ'
        throw new Error(`HTTP ${response.status}: ${msg}`, { cause: userMessage })
      }

      const data: CalendarEvent[] = await response.json()
      setEvents(data)
      setCacheNote(null)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events: data })) } catch { /* ignore */ }

      const todayStr    = new Date().toDateString()
      const todayEvents = data.filter((e) => new Date(e.start).toDateString() === todayStr)
      if (todayEvents.length > 0) {
        pushNotifications([{
          id: 'calendar-today', type: 'calendar', level: 'info',
          title: `งานวันนี้ ${todayEvents.length} รายการ`,
          body: todayEvents.slice(0, 3).map((e) => e.title).join(', ') + (todayEvents.length > 3 ? ` และอีก ${todayEvents.length - 3} รายการ` : ''),
          at: new Date(),
        }])
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('❌ Calendar API Error:', err)
      setError(err?.cause || 'ไม่สามารถโหลดข้อมูลปฏิทินได้')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [CACHE_KEY, CALENDAR_ID, monthKey])

  useEffect(() => { fetchCalendarEvents() }, [fetchCalendarEvents])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return
      const cached = JSON.parse(raw) as { savedAt: number; events: CalendarEvent[] }
      if (!cached?.savedAt || !Array.isArray(cached.events)) return
      if (Date.now() - cached.savedAt > CACHE_TTL_MS) return
      setEvents(cached.events)
      setCacheNote('แสดงข้อมูลจากแคช')
      setLoading(false)
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CACHE_KEY])

  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Event helpers ─────────────────────────────────────────────────────────────

  const hasIMACD      = (e: CalendarEvent) => e.title.toLowerCase().includes('imacd') || (e.description?.toLowerCase().includes('imacd') ?? false)
  const hasThanapong  = (e: CalendarEvent) => { const n = (s: string) => s.normalize('NFC'); const needle = n('ธัญพงศ์'); return n(e.title).includes(needle) || n(e.description ?? '').includes(needle) }

  const imacdTotalCount     = events.filter((e) => hasIMACD(e)).length
  const thanapongTotalCount = events.filter((e) => hasThanapong(e)).length

  const parseEventTitle = (title: string) => {
    const idx = title.indexOf(':')
    if (idx !== -1) return { category: title.slice(0, idx).trim(), details: title.slice(idx + 1).trim() }
    if (title.toLowerCase().includes('installation')) return { category: 'Installation', details: title }
    if (title.toLowerCase().includes('demo'))         return { category: 'DEMO',         details: title }
    if (title.toLowerCase().includes('training'))     return { category: 'Training',     details: title }
    return { category: 'Task', details: title }
  }

  const categoryCounts = events.reduce<Record<string, number>>((acc, e) => {
    const { category } = parseEventTitle(e.title)
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {})

  const filteredEvents = events.filter((event) => {
    if (filter === 'imacd'     && !hasIMACD(event))     return false
    if (filter === 'thanapong' && !hasThanapong(event)) return false
    if (categoryFilter !== 'all' && !(hasIMACD(event) || hasThanapong(event))) {
      if (parseEventTitle(event.title).category !== categoryFilter) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!event.title.toLowerCase().includes(q) && !(event.description?.toLowerCase().includes(q)) && !(event.location?.toLowerCase().includes(q))) return false
    }
    return true
  }).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())

  const sanitizeDescription = useCallback((html: string) => {
    const withHighlights = html
      .replace(/รายละเอียดของงาน:/g, '<strong>รายละเอียดของงาน:</strong>')
      .replace(/วิธีการดำเนินงาน:/g, '<strong>วิธีการดำเนินงาน:</strong>')
      .replace(/ผู้ให้บริการ\s*:/g,  '<strong>ผู้ให้บริการ :</strong>')
      .replace(/หมายเลขงาน\s*:/g,    '<strong>หมายเลขงาน :</strong>')
      .replace(/ผู้ดำเนินการ\s*:/g,  '<strong>ผู้ดำเนินการ :</strong>')
      .replace(/<a /gi, '<a class="font-bold text-[#0071e3] hover:underline" target="_blank" rel="noopener noreferrer" ')
    return DOMPurify.sanitize(withHighlights, { USE_PROFILES: { html: true } })
  }, [])

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white p-8 ring-1 ring-black/[0.06]">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
            <p className="text-sm text-[#6e6e73]">กำลังโหลดข้อมูลจาก SharePoint List...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white p-8 ring-1 ring-black/[0.06]">
        <div className="py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" aria-hidden="true" />
          <p className="mb-4 font-medium text-[#1d1d1f]">{error}</p>
          <button
            onClick={fetchCalendarEvents}
            className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#0077ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  // ── Category color map ────────────────────────────────────────────────────────

  const categoryColors: Record<string, { badge: string; active: string; inactive: string }> = {
    'DEMO':            { badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', active: 'bg-emerald-500 text-white', inactive: 'text-emerald-600 hover:bg-emerald-50' },
    'Installation':    { badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',         active: 'bg-blue-500 text-white',    inactive: 'text-blue-600 hover:bg-blue-50' },
    'Task':            { badge: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',   active: 'bg-orange-500 text-white',  inactive: 'text-orange-600 hover:bg-orange-50' },
    'Onsite Services': { badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',      active: 'bg-amber-500 text-white',   inactive: 'text-amber-600 hover:bg-amber-50' },
    'Training':        { badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',   active: 'bg-purple-500 text-white',  inactive: 'text-purple-600 hover:bg-purple-50' },
  }
  const defaultCategoryColors = { badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', active: 'bg-slate-600 text-white', inactive: 'text-slate-500 hover:bg-slate-100' }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex h-full flex-col rounded-2xl bg-white ring-1 ring-black/[0.06] ${
        width === 2 ? 'p-3 sm:p-4' : 'p-4 sm:p-5'
      }`}
      role="region"
      aria-label="งานของฉัน"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className={`flex flex-col gap-3 border-b border-black/[0.05] pb-3 sm:pb-4 ${
        width > 1 ? 'lg:flex-row lg:items-center lg:justify-between lg:pb-5' : ''
      }`}>
        <div className="flex min-w-0 items-center gap-3">
          {/* Icon badge */}
          <div className={`flex shrink-0 items-center justify-center rounded-[10px] bg-red-50 ${
            width === 2 ? 'h-8 w-8' : 'h-10 w-10 sm:h-11 sm:w-11'
          }`}>
            <Bell
              size={width === 2 ? 14 : 20}
              className="fill-red-500/10 text-red-500 animate-pulse-slow"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2 className={`font-bold tracking-tight text-[#1d1d1f] ${
              width === 2 ? 'text-xs sm:text-[13px]' : 'text-[13px] sm:text-[15px]'
            }`}>
              รายการงาน ({filteredEvents.length})
            </h2>
            {width > 1 && (
              <p className={`mt-0.5 text-[#6e6e73] ${width === 2 ? 'text-[10px]' : 'text-[11px]'}`}>
                กรองจาก {events.length} รายการใน{' '}
                {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                {cacheNote ? ` · ${cacheNote}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Controls: search + refresh + resize */}
        <div className={`flex flex-wrap items-center gap-2 ${width === 2 ? 'w-full' : 'justify-end'}`}>
          {/* Search */}
          <div className={`relative flex-1 ${width === 2 ? 'min-w-[120px]' : 'min-w-[150px]'}`}>
            <Search
              size={width === 2 ? 12 : 13}
              className="absolute inset-y-0 left-3 my-auto text-[#6e6e73]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหางาน..."
              className={[
                'w-full rounded-full bg-[#f5f5f7] py-2 pr-3 text-[#1d1d1f] ring-1 ring-black/[0.06]',
                'placeholder:text-[#6e6e73]',
                'border-none outline-none',
                'transition-all duration-150 focus:bg-white focus:ring-2 focus:ring-[#0071e3]',
                width === 2 ? 'pl-6 text-[11px]' : 'pl-7 text-xs',
              ].join(' ')}
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchCalendarEvents}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f5f5f7] px-3 py-2 text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06] transition-all duration-150 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            aria-label="รีเฟรชข้อมูลงาน"
          >
            <RotateCw size={width === 2 ? 11 : 13} aria-hidden="true" />
            {width > 1 && <span>รีเฟรช</span>}
          </button>

          {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[2, 3]} />}
        </div>
      </div>

      {/* ── Primary filter chips ─────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-black/[0.05] py-3 sm:gap-2"
        role="group"
        aria-label="ตัวกรองงาน"
      >
        {(['all', 'imacd', 'thanapong'] as const).map((f) => {
          const isActive = filter === f
          const label =
            f === 'all'       ? 'ทั้งหมด'
            : f === 'imacd'   ? `IMACD: ${imacdTotalCount}`
            :                   `ธัญพงศ์: ${thanapongTotalCount}`
          const activeStyle =
            f === 'imacd'     ? 'bg-red-500 text-white ring-red-500'
            : f === 'thanapong' ? 'bg-[#0071e3] text-white ring-[#0071e3]'
            :                    'bg-[#1d1d1f] text-white ring-[#1d1d1f]'
          const inactiveStyle =
            f === 'imacd'     ? 'text-red-600 ring-red-200 hover:bg-red-50'
            : f === 'thanapong' ? 'text-[#0071e3] ring-blue-200 hover:bg-blue-50'
            :                    'text-[#6e6e73] ring-black/[0.06] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'

          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={isActive}
              className={[
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1',
                isActive ? activeStyle : `bg-white ${inactiveStyle}`,
              ].join(' ')}
            >
              {f !== 'all' && <Tag size={10} className="fill-current" aria-hidden="true" />}
              {width > 1 || f === 'all' ? label : (f === 'imacd' ? imacdTotalCount : thanapongTotalCount)}
            </button>
          )
        })}
      </div>

      {/* ── Category filter chips ────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-black/[0.05] px-1 py-2.5"
        role="group"
        aria-label="กรองตามประเภท"
      >
        <button
          onClick={() => setCategoryFilter('all')}
          aria-pressed={categoryFilter === 'all'}
          className={[
            'rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]',
            categoryFilter === 'all'
              ? 'bg-[#1d1d1f] text-white ring-[#1d1d1f]'
              : 'bg-transparent text-[#6e6e73] ring-transparent hover:bg-[#f5f5f7] hover:text-[#1d1d1f]',
          ].join(' ')}
        >
          ทุกประเภท
        </button>
        {Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => {
            const colors = categoryColors[cat] ?? defaultCategoryColors
            const isActive = categoryFilter === cat
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                aria-pressed={isActive}
                className={[
                  'rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]',
                  isActive
                    ? colors.active
                    : `bg-transparent ring-transparent ${colors.inactive}`,
                ].join(' ')}
              >
                {cat}: {count}
              </button>
            )
          })}
      </div>

      {/* ── Task grid ────────────────────────────────────────────────── */}
      {filteredEvents.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="mx-auto mb-2 h-10 w-10 text-slate-200" aria-hidden="true" />
          <p className="text-sm text-[#6e6e73]">ไม่พบรายการงาน</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-0.5" style={{ maxHeight: '600px' }}>
          <div className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => {
              const { category, details } = parseEventTitle(event.title)
              const hasI  = hasIMACD(event)
              const hasT  = hasThanapong(event)
              const start = new Date(event.start)
              const end   = new Date(event.end)
              const day   = start.getDate()
              const monthShort = start.toLocaleDateString('th-TH', { month: 'short' })
              const timeStr    = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`
              const endTimeStr = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`

              const borderColor = hasI && hasT ? 'border-l-purple-400'
                : hasI ? 'border-l-red-500'
                : hasT ? 'border-l-[#0071e3]'
                :        'border-l-black/[0.08]'

              const catColors = categoryColors[category] ?? defaultCategoryColors

              return (
                <div
                  key={event.id}
                  className={`flex flex-col gap-1.5 rounded-xl border-l-[3px] bg-[#f5f5f7] p-3 transition-all duration-150 hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-black/[0.06] ${borderColor}`}
                >
                  {/* Date + time */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#0071e3]">{day} {monthShort}</span>
                    <span className="text-[11px] text-[#6e6e73]">{timeStr}–{endTimeStr}</span>
                  </div>

                  {/* Category badge */}
                  <span className={`inline-block self-start rounded-md px-2 py-0.5 text-[11px] font-bold ${catColors.badge}`}>
                    {category}
                  </span>

                  {/* Details */}
                  <p className="line-clamp-1 text-[12px] font-semibold leading-snug text-[#1d1d1f]">
                    {details}
                  </p>

                  {/* Description */}
                  {event.description && (
                    <div className="overflow-hidden rounded-lg bg-white p-2 text-[11px] leading-relaxed text-[#6e6e73] ring-1 ring-black/[0.05]">
                      <div
                        className="prose prose-xs max-w-none text-[#6e6e73] [&_a]:font-bold [&_a]:text-[#0071e3] [&_strong]:text-[#1d1d1f]"
                        dangerouslySetInnerHTML={{ __html: sanitizeDescription(event.description) }}
                      />
                    </div>
                  )}

                  {/* Footer tags */}
                  <div className="mt-auto flex items-center gap-1 pt-0.5">
                    {hasI && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500">IMACD</span>}
                    {hasT && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white bg-[#0071e3]">ธัญพงศ์</span>}
                    {event.location && (
                      <span className="ml-auto flex max-w-[80px] items-center gap-0.5 truncate text-[10px] text-[#6e6e73]">
                        <MapPin size={9} aria-hidden="true" />
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
