'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, X, AlertTriangle, Cloud, Fuel, Calendar, Info, CheckCheck } from 'lucide-react'

export interface Notification {
  id: string
  type: 'weather' | 'oilprice' | 'calendar' | 'system'
  level: 'info' | 'warning' | 'danger'
  title: string
  body: string
  at: Date
}

/** Exposed so widgets can push alerts */
type Listener = (notifications: Notification[]) => void
const listeners = new Set<Listener>()
let store: Notification[] = []

export function pushNotifications(items: Notification[]) {
  // Merge by id (upsert)
  const map = new Map(store.map(n => [n.id, n]))
  items.forEach(n => map.set(n.id, n))
  store = Array.from(map.values()).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30)
  listeners.forEach(fn => fn([...store]))
}

const levelIcon = {
  info: <Info size={14} className="text-sky-500 flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />,
  danger: <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />,
}
const typeIcon = {
  weather: <Cloud size={13} />,
  oilprice: <Fuel size={13} />,
  calendar: <Calendar size={13} />,
  system: <Info size={13} />,
}

const levelMeta = {
  info: {
    label: 'ข้อมูล',
    itemClass: 'bg-sky-50/70 border-sky-100',
    badgeClass: 'bg-sky-100 text-sky-800',
    iconWrapClass: 'bg-sky-100 text-sky-700',
  },
  warning: {
    label: 'ควรตรวจสอบ',
    itemClass: 'bg-amber-50/80 border-amber-100',
    badgeClass: 'bg-amber-100 text-amber-900',
    iconWrapClass: 'bg-amber-100 text-amber-700',
  },
  danger: {
    label: 'สำคัญ',
    itemClass: 'bg-red-50/80 border-red-100',
    badgeClass: 'bg-red-100 text-red-800',
    iconWrapClass: 'bg-red-100 text-red-700',
  },
}

const typeLabel = {
  weather: 'สภาพอากาศ',
  oilprice: 'ราคาน้ำมัน',
  calendar: 'ปฏิทิน',
  system: 'ระบบ',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([...store])
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn: Listener = (items) => setNotifications([...items])
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = notifications.filter(n => !readIds.has(n.id)).length

  const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)))

  const formatTime = (date: Date) => date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const dismiss = (id: string) => {
    store = store.filter(n => n.id !== id)
    setNotifications([...store])
    listeners.forEach(fn => fn([...store]))
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        aria-label={`การแจ้งเตือน${unread > 0 ? ` (${unread} ใหม่)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),28rem)] overflow-hidden rounded-2xl border border-white/50 bg-white/95 backdrop-blur-xl shadow-glass-lg">
          {/* Panel header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <span className="block text-base font-bold text-slate-950">การแจ้งเตือน</span>
              <span className="mt-0.5 block text-xs font-medium text-slate-500">
                {notifications.length > 0 ? `${notifications.length} รายการ${unread > 0 ? `, ยังไม่ได้อ่าน ${unread} รายการ` : ''}` : 'ไม่มีรายการที่ต้องตรวจสอบ'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                  <CheckCheck size={14} aria-hidden="true" />
                  ทำเครื่องหมายว่าอ่านแล้ว
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[26rem] overflow-y-auto p-3">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-slate-500">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-glass-sm">
                  <Bell size={22} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-slate-700">ไม่มีการแจ้งเตือน</span>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">เมื่อมีรายการจากสภาพอากาศ ปฏิทิน หรือระบบ จะแสดงที่นี่</p>
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                className={`relative mb-2 flex gap-3 rounded-xl border px-4 py-3.5 transition-colors last:mb-0 ${levelMeta[n.level].itemClass} ${readIds.has(n.id) ? 'opacity-75' : ''}`}
              >
                {!readIds.has(n.id) && (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-sky-500" aria-label="ยังไม่ได้อ่าน" />
                )}
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${levelMeta[n.level].iconWrapClass}`}>
                  {levelIcon[n.level]}
                </div>
                <div className="min-w-0 flex-1 pr-7">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200/70">
                      <span className="text-slate-500">{typeIcon[n.type]}</span>
                      {typeLabel[n.type]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelMeta[n.level].badgeClass}`}>
                      {levelMeta[n.level].label}
                    </span>
                  </div>
                  <div className="text-sm font-bold leading-snug text-slate-950">{n.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{n.body}</p>
                  <span className="mt-2 block text-xs font-medium text-slate-500">
                    {formatTime(n)} น.
                  </span>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
                  className="absolute right-2 top-8 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  aria-label="ปิดการแจ้งเตือนนี้"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
