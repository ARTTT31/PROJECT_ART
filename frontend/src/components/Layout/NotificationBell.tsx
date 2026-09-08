'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Bell,
  X,
  AlertTriangle,
  Fuel,
  Info,
  CheckCheck,
  Palmtree,
  CloudRain,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react'

export interface Notification {
  id: string
  type: 'holiday' | 'weather' | 'oilprice' | 'system'
  level: 'info' | 'warning' | 'danger'
  title: string
  body: string
  at: Date
}

type Listener = (notifications: Notification[]) => void
const listeners = new Set<Listener>()
let store: Notification[] = []

export function pushNotifications(items: Notification[]) {
  const map = new Map(store.map((n) => [n.id, n]))
  items.forEach((n) => map.set(n.id, n))
  store = Array.from(map.values())
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 30)
  listeners.forEach((fn) => fn([...store]))
}

import { getHolidaysWithDiff } from '@/utils/holidays'

const levelIcon = {
  info: <Info size={14} className="text-sky-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />,
  danger: <ShieldAlert size={14} className="text-rose-500 shrink-0 mt-0.5" />,
}

const typeIcon = {
  holiday: <Palmtree size={13} className="text-emerald-600" />,
  weather: <CloudRain size={13} className="text-sky-600" />,
  oilprice: <Fuel size={13} className="text-amber-600" />,
  system: <Sparkles size={13} className="text-purple-600" />,
}

const levelMeta = {
  info: {
    label: 'ข้อมูล',
    itemClass: 'bg-sky-50/70 border-sky-100',
    badgeClass: 'bg-sky-100 text-sky-800',
    iconWrapClass: 'bg-sky-100 text-sky-700',
  },
  warning: {
    label: 'แจ้งเตือน',
    itemClass: 'bg-amber-50/80 border-amber-100',
    badgeClass: 'bg-amber-100 text-amber-900',
    iconWrapClass: 'bg-amber-100 text-amber-700',
  },
  danger: {
    label: 'สำคัญเร่งด่วน',
    itemClass: 'bg-rose-50/80 border-rose-100',
    badgeClass: 'bg-rose-100 text-rose-800',
    iconWrapClass: 'bg-rose-100 text-rose-700',
  },
}

const typeLabel = {
  holiday: 'วันหยุด',
  weather: 'สภาพอากาศ',
  oilprice: 'ราคาน้ำมัน',
  system: 'ระบบ',
}

const READ_STORAGE_KEY = 'artNotificationReadV2'
const DISMISSED_STORAGE_KEY = 'artNotificationDismissedV2'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([...store])
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Smart Notifications Generator ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    const smartAlerts: Notification[] = []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let dismissedSet = new Set<string>()
    try {
      const dismissedRaw = localStorage.getItem(DISMISSED_STORAGE_KEY)
      if (dismissedRaw) dismissedSet = new Set(JSON.parse(dismissedRaw))
    } catch {}

    // 1. Check Thai Holidays Alert
    const holidaysWithDiff = getHolidaysWithDiff(today)

    const nextHoliday = holidaysWithDiff.find((h) => h.daysLeft >= 0)
    if (nextHoliday) {
      if (nextHoliday.daysLeft === 0) {
        const id = `holiday-today-${nextHoliday.id}`
        if (!dismissedSet.has(id)) {
          smartAlerts.push({
            id,
            type: 'holiday',
            level: 'info',
            title: `วันนี้เป็นวันหยุดนักขัตฤกษ์: ${nextHoliday.title} 🎉`,
            body: `สุขสันต์วันหยุด ขอให้พักผ่อนอย่างมีความสุขครับ`,
            at: now,
          })
        }
      } else if (nextHoliday.daysLeft <= 7) {
        const id = `holiday-upcoming-${nextHoliday.id}-${nextHoliday.daysLeft}`
        if (!dismissedSet.has(id)) {
          smartAlerts.push({
            id,
            type: 'holiday',
            level: 'info',
            title: `ใกล้ถึงวันหยุด: ${nextHoliday.title} 🏖️`,
            body: `อีก ${nextHoliday.daysLeft} วัน จะถึงวันหยุด (${nextHoliday.dayOfWeek} ${nextHoliday.day} ${nextHoliday.monthName})`,
            at: now,
          })
        }
      }
    }

    // 2. Check Weather & Air Quality Alert
    try {
      const weatherCacheRaw =
        localStorage.getItem('artWeatherCacheV7') ||
        localStorage.getItem('artWeatherCacheV6') ||
        localStorage.getItem('artWeatherCacheV5')
      if (weatherCacheRaw) {
        const parsed = JSON.parse(weatherCacheRaw)
        const pm25 = parsed?.airQuality?.pm25
        const rainProb = parsed?.weather?.rainProb
        const cityName = parsed?.cityName || 'พื้นที่ของคุณ'

        if (typeof pm25 === 'number') {
          if (pm25 >= 37.6) {
            const id = 'weather-pm25-high'
            if (!dismissedSet.has(id)) {
              smartAlerts.push({
                id,
                type: 'weather',
                level: 'danger',
                title: `แจ้งเตือนฝุ่น PM 2.5 สูงใน${cityName} ⚠️`,
                body: `ค่าฝุ่น PM 2.5 อยู่ที่ ${pm25} µg/m³ (เริ่มมีผลกระทบต่อสุขภาพ) ควรสวมหน้ากากป้องกันเมื่อออกกลางแจ้ง`,
                at: now,
              })
            }
          } else if (pm25 <= 15) {
            const id = 'weather-pm25-good'
            if (!dismissedSet.has(id)) {
              smartAlerts.push({
                id,
                type: 'weather',
                level: 'info',
                title: `คุณภาพอากาศใน${cityName}อยู่ในเกณฑ์ดีมาก 🌿`,
                body: `ค่าฝุ่น PM 2.5 อยู่ที่ ${pm25} µg/m³ อากาศบริสุทธิ์ เหมาะกับการทำกิจกรรมกลางแจ้ง`,
                at: now,
              })
            }
          }
        }

        if (typeof rainProb === 'number' && rainProb >= 60) {
          const id = 'weather-rain-high'
          if (!dismissedSet.has(id)) {
            smartAlerts.push({
              id,
              type: 'weather',
              level: 'warning',
              title: `โอกาสเกิดฝนตกสูง ${rainProb}% 🌧️`,
              body: `พยากรณ์อากาศระบุว่ามีโอกาสเกิดฝนตกสูง อย่าลืมพกร่มก่อนออกจากอาคาร`,
              at: now,
            })
          }
        }
      }
    } catch {}

    // 3. System Welcome Notification — show only once (respect dismissed)
    const sysId = 'system-workspace-ready'
    if (!dismissedSet.has(sysId)) {
      // Also check if already shown this session via sessionStorage to avoid re-showing on soft navigations
      const shownThisSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sysId)
      if (!shownThisSession) {
        smartAlerts.push({
          id: sysId,
          type: 'system',
          level: 'info',
          title: 'ระบบ ART Workspace พร้อมใช้งาน ✨',
          body: 'คุณสามารถปรับแต่ง จัดเรียงวิดเจ็ต และตั้งค่าลิงก์ด่วนได้ตามต้องการ',
          at: now,
        })
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(sysId, '1')
        }
      }
    }

    if (smartAlerts.length > 0) {
      pushNotifications(smartAlerts)
    }
  }, [])

  // Subscribe to store updates
  useEffect(() => {
    const fn: Listener = (items) => setNotifications([...items])
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  // Save readIds to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(readIds)))
    } catch {}
  }, [readIds])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length
  }, [notifications, readIds])

  const markAllRead = () => {
    const allIds = new Set(notifications.map((n) => n.id))
    setReadIds(allIds)
  }

  const clearAllNotifications = () => {
    if (typeof window !== 'undefined') {
      try {
        const allIds = notifications.map((n) => n.id)
        localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(allIds))
      } catch {}
    }
    store = []
    setNotifications([])
    listeners.forEach((fn) => fn([]))
  }

  const dismiss = (id: string) => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DISMISSED_STORAGE_KEY)
        const parsed: string[] = saved ? JSON.parse(saved) : []
        if (!parsed.includes(id)) {
          parsed.push(id)
          localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(parsed))
        }
      } catch {}
    }
    store = store.filter((n) => n.id !== id)
    setNotifications([...store])
    listeners.forEach((fn) => fn([...store]))
  }

  const formatTime = (date: Date) =>
    date.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#1d1d1f] transition-all duration-150 hover:bg-black/[0.05] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} รายการใหม่)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2.5 w-[min(calc(100vw-2rem),26rem)] overflow-hidden rounded-[22px] border border-black/[0.08] bg-[rgba(255,255,255,0.92)] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.14)] animate-in fade-in zoom-in-95 duration-150">
          {/* Panel Header */}
          <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] px-5 py-4 bg-white/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-[#1d1d1f]">การแจ้งเตือน</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#ff3b30]/10 px-2 py-0.5 text-[11px] font-bold text-[#ff3b30]">
                    {unreadCount} ใหม่
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-[#86868b]">
                {notifications.length > 0
                  ? `ทั้งหมด ${notifications.length} รายการ`
                  : 'ไม่มีการแจ้งเตือนในขณะนี้'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {notifications.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold text-[#0071e3] hover:bg-[#0071e3]/10 transition-colors"
                    title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
                  >
                    <CheckCheck size={14} />
                    <span>อ่านแล้ว</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="inline-flex items-center justify-center rounded-full h-7 w-7 text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                    title="ล้างการแจ้งเตือนทั้งหมด"
                    aria-label="ล้างทั้งหมด"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[26rem] overflow-y-auto p-3 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-black/[0.08] bg-[#f5f5f7]/60 px-6 py-10 text-center text-[#86868b]">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#86868b] shadow-sm ring-1 ring-black/[0.04]">
                  <Bell size={20} />
                </div>
                <span className="text-[13px] font-bold text-[#1d1d1f]">ไม่มีการแจ้งเตือนใหม่</span>
                <p className="mt-0.5 text-[12px] text-[#86868b]">
                  ระบบจะแจ้งเตือนอัตโนมัติเมื่อใกล้ถึงวันหยุด หรือมีข้อมูลสภาพอากาศสำคัญ
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = readIds.has(n.id)
                const meta = levelMeta[n.level]
                return (
                  <div
                    key={n.id}
                    className={`relative flex gap-3 rounded-[16px] border p-3.5 transition-all duration-150 ${
                      meta.itemClass
                    } ${isRead ? 'opacity-60' : 'shadow-sm ring-1 ring-black/[0.04]'}`}
                  >
                    {!isRead && (
                      <span
                        className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-[#0071e3]"
                        aria-label="ยังไม่ได้อ่าน"
                      />
                    )}

                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${meta.iconWrapClass}`}
                    >
                      {levelIcon[n.level]}
                    </div>

                    <div className="min-w-0 flex-1 pr-6">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#1d1d1f] shadow-2xs ring-1 ring-black/[0.04]">
                          {typeIcon[n.type]}
                          <span>{typeLabel[n.type]}</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <h4 className="text-[13px] font-bold leading-snug text-[#1d1d1f]">{n.title}</h4>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[#6e6e73]">{n.body}</p>

                      <span className="mt-1.5 block text-[11px] font-medium text-[#86868b]">
                        {formatTime(n.at)} น.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      className="absolute right-2.5 top-8 rounded-full p-1 text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors"
                      aria-label="ปิดการแจ้งเตือนนี้"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
