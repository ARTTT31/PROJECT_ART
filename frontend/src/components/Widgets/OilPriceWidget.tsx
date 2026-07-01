'use client'

import { useEffect, useRef, useState } from 'react'
import { Fuel, AlertCircle } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'

interface OilPrice {
  key: string
  name: string
  price: number
  unit: string
  icon: string
}

interface OilPriceData {
  success: boolean
  prices?: OilPrice[]
  oil_prices?: OilPrice[]
  update_date: string
  source: string
  is_stale?: boolean
  fetched_at?: string | null
}

type OilCache = { savedAt: number; data: OilPriceData; lastUpdate: number }

const OIL_CACHE_KEY = 'artOilPriceCacheV1'
const OIL_CACHE_TTL_MS = 30 * 60_000 // 30 นาที

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function loadOilCache(): OilCache | null {
  const cached = safeJsonParse<OilCache>(typeof window !== 'undefined' ? localStorage.getItem(OIL_CACHE_KEY) : null)
  if (!cached || !cached.savedAt || !cached.data) return null
  return cached
}

function saveOilCache(cache: OilCache) {
  try {
    localStorage.setItem(OIL_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

/* ── Fuel color map (dot indicator per type) ────────────────── */
const fuelDotColor: Record<string, string> = {
  benzene_95: 'bg-red-500',
  gasohol_95: 'bg-orange-500',
  gasohol_91: 'bg-yellow-500',
  gasohol_e20: 'bg-green-500',
  gasohol_e85: 'bg-green-500',
  diesel: 'bg-blue-500',
}

const defaultDotColor = 'bg-slate-400'

/* ── Short display names ────────────────────────────────────── */
const shortName: Record<string, string> = {
  benzene_95: 'เบนซิน',
  gasohol_95: 'แก๊ส 95',
  gasohol_91: 'แก๊ส 91',
  gasohol_e20: 'E20',
  gasohol_e85: 'E85',
  diesel: 'ดีเซล',
}

export default function OilPriceWidget({
  width = 1,
  onResize
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [data, setData] = useState<OilPriceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchPrices = async (opts?: { refresh?: boolean }) => {
    const isRefresh = Boolean(opts?.refresh)
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth('/api/v1/oil-prices/oil-prices', { signal: controller.signal })
      const result = await res.json()
      if (result.success && (result.prices || result.oil_prices)) {
        setData(result)
        setCacheNote(null)
        saveOilCache({ savedAt: Date.now(), data: result, lastUpdate: Date.now() })
      } else {
        setError('ไม่สามารถดึงข้อมูลราคาน้ำมันได้')
      }
      setLastUpdate(new Date())
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('Oil price fetch error:', err)
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // hydrate from cache first (ลดหน้ากระพริบเมื่อเน็ตช้า)
    const cached = loadOilCache()
    if (cached && Date.now() - cached.savedAt <= OIL_CACHE_TTL_MS) {
      setData(cached.data)
      setLastUpdate(new Date(cached.lastUpdate || cached.savedAt))
      setCacheNote('แสดงข้อมูลจากแคช')
      setLoading(false)
    }

    fetchPrices()
    const interval = setInterval(() => fetchPrices({ refresh: true }), 300000) // every 5 minutes
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  /* ── Loading skeleton ─────────────────────────────────────── */
  if (loading && !data) {
    return (
      <div className="premium-card !rounded-[14px] p-5 min-h-[200px] flex items-center justify-center" role="status" aria-live="polite">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 p-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-200" />
                <div className="h-4 w-16 rounded-full bg-slate-200" />
              </div>
              <div className="h-8 w-20 rounded-lg bg-slate-100" />
              <div className="h-3 w-16 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Main render ──────────────────────────────────────────── */
  return (
    <section className="premium-card !rounded-[14px] h-full flex flex-col" aria-labelledby="oil-price-title">
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-100/80 text-amber-700">
              <Fuel size={18} />
            </div>
            <div>
              <h3 id="oil-price-title" className="text-base font-bold text-slate-900 tracking-tight">ราคาน้ำมัน</h3>
              {data && (
                <p className="text-[11px] text-slate-500">
                  อัปเดต {data.update_date || lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  {data.source !== 'EPPO' && ` • ${data.source}`}
                </p>
              )}
              {data?.is_stale && (
                <p className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
                  <AlertCircle size={11} className="flex-shrink-0" aria-hidden="true" />
                  ข้อมูลอาจไม่เป็นปัจจุบัน
                </p>
              )}
              {(loading || refreshing) && <p className="text-[11px] text-slate-500">กำลังอัปเดต...</p>}
              {cacheNote && <p className="text-[11px] text-slate-500">{cacheNote}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="alert alert-error !px-3 !py-2 !text-xs">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Card Grid ── */}
        {data && (data.oil_prices || data.prices || []).length > 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
            {[...(data.oil_prices || data.prices || [])].sort((a, b) => {
              const order = ['benzene_95', 'gasohol_95', 'gasohol_91', 'gasohol_e20', 'gasohol_e85', 'diesel']
              return order.indexOf(a.key) - order.indexOf(b.key)
            }).map((item, idx) => {
              const dotColor = fuelDotColor[item.key] || defaultDotColor

              return (
                <div
                  key={item.key || idx}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-4 transition-all duration-200 hover:shadow-md hover:border-slate-300/80 cursor-default"
                >
                  {/* Dot + Name */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                    <span className="text-xs sm:text-sm font-bold text-slate-800 text-center leading-tight">{shortName[item.key] || item.name}</span>
                  </div>

                  {/* Price */}
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums leading-none">
                    {item.price.toFixed(2)}
                  </span>

                  {/* Unit */}
                  <span className="text-[11px] text-slate-400 font-medium">{item.unit}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            ไม่มีข้อมูลราคาน้ำมัน
          </div>
        )}

        {/* ── Footer source ── */}
        <div className="pt-1 border-t border-slate-100">
          <span className="text-[10px] text-slate-400">แหล่งข้อมูล: {data?.source || 'EPPO'}</span>
        </div>
      </div>
    </section>
  )
}
