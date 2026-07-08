'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Fuel } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Cache helpers ─────────────────────────────────────────────────────────────

const OIL_CACHE_KEY = 'artOilPriceCacheV1'
const OIL_CACHE_TTL_MS = 30 * 60_000 // 30 min

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

function loadOilCache(): OilCache | null {
  const cached = safeJsonParse<OilCache>(
    typeof window !== 'undefined' ? localStorage.getItem(OIL_CACHE_KEY) : null,
  )
  if (!cached?.savedAt || !cached.data) return null
  return cached
}

function saveOilCache(cache: OilCache) {
  try { localStorage.setItem(OIL_CACHE_KEY, JSON.stringify(cache)) } catch { /* ignore */ }
}

// ── Fuel display maps ─────────────────────────────────────────────────────────

/** Tailwind dot color per fuel type */
const fuelDotColor: Record<string, string> = {
  benzene_95:  'bg-red-500',
  gasohol_95:  'bg-orange-500',
  gasohol_91:  'bg-yellow-500',
  gasohol_e20: 'bg-green-500',
  gasohol_e85: 'bg-green-500',
  diesel:      'bg-blue-500',
}
const defaultDotColor = 'bg-slate-400'

const shortName: Record<string, string> = {
  benzene_95:  'เบนซิน',
  gasohol_95:  'แก๊ส 95',
  gasohol_91:  'แก๊ส 91',
  gasohol_e20: 'E20',
  gasohol_e85: 'E85',
  diesel:      'ดีเซล',
}

const PRICE_ORDER = ['benzene_95', 'gasohol_95', 'gasohol_91', 'gasohol_e20', 'gasohol_e85', 'diesel']

// ── Component ─────────────────────────────────────────────────────────────────

export default function OilPriceWidget({
  width = 1,
  onResize,
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [data, setData]           = useState<OilPriceData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchPrices = async (opts?: { refresh?: boolean }) => {
    const isRefresh = Boolean(opts?.refresh)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(null)

    try {
      const res = await fetchWithAuth('/api/v1/oil-prices/oil-prices', { signal: controller.signal })

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        const msg = detail?.detail || res.statusText
        let userMessage = 'ไม่สามารถโหลดข้อมูลราคาน้ำมันได้'
        if (res.status === 502 || res.status === 504) {
          userMessage = 'เชื่อมต่อ EPPO ไม่สำเร็จ — กำลังแสดงข้อมูลสำรอง'
          console.warn('🌐 EPPO connection error:', msg)
        } else if (res.status === 503) {
          userMessage = 'บริการ EPPO ไม่พร้อมใช้งานชั่วคราว'
          console.error('⚠️ EPPO service unavailable:', msg)
        } else {
          console.error('❌ Oil price API error:', msg)
        }
        throw new Error(`HTTP ${res.status}: ${msg}`, { cause: userMessage })
      }

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
      console.error('❌ Oil price fetch error:', err)
      setError(err?.cause || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const cached = loadOilCache()
    if (cached && Date.now() - cached.savedAt <= OIL_CACHE_TTL_MS) {
      setData(cached.data)
      setLastUpdate(new Date(cached.lastUpdate || cached.savedAt))
      setCacheNote('แสดงข้อมูลจากแคช')
      setLoading(false)
    }
    fetchPrices()
    const interval = setInterval(() => fetchPrices({ refresh: true }), 300_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div
        className="flex min-h-[220px] items-center justify-center rounded-2xl bg-white p-5 ring-1 ring-black/[0.06]"
        role="status"
        aria-live="polite"
        aria-label="กำลังโหลดราคาน้ำมัน"
      >
        <div className="grid w-full animate-pulse grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-[#f5f5f7] p-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <div className="h-3.5 w-14 rounded-full bg-slate-200" />
              </div>
              <div className="h-7 w-16 rounded-lg bg-slate-200" />
              <div className="h-2.5 w-12 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  const prices = [...(data?.oil_prices ?? data?.prices ?? [])].sort(
    (a, b) => PRICE_ORDER.indexOf(a.key) - PRICE_ORDER.indexOf(b.key),
  )

  return (
    <section
      className="flex h-full flex-col rounded-2xl bg-white ring-1 ring-black/[0.06]"
      aria-labelledby="oil-price-title"
    >
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f5f5f7]">
              <Fuel size={18} className="text-[#1d1d1f]" aria-hidden="true" />
            </div>

            <div>
              <h3
                id="oil-price-title"
                className="text-[15px] font-bold tracking-tight text-[#1d1d1f]"
              >
                ราคาน้ำมัน
              </h3>

              {/* Meta line */}
              <p className="mt-0.5 text-[11px] text-[#6e6e73]">
                {(loading || refreshing)
                  ? 'กำลังอัปเดต...'
                  : cacheNote
                  ? cacheNote
                  : data
                  ? `อัปเดต ${data.update_date || lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </p>

              {/* Stale warning */}
              {data?.is_stale && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <AlertCircle size={10} aria-hidden="true" />
                  ข้อมูลอาจไม่เป็นปัจจุบัน
                </p>
              )}
            </div>
          </div>

          {onResize && (
            <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />
          )}
        </div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200">
            <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* ── Price cards ───────────────────────────────────────────────── */}
        {prices.length > 0 ? (
          <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3">
            {prices.map((item, idx) => (
              <div
                key={item.key || idx}
                className="flex cursor-default flex-col items-center justify-center gap-2 rounded-2xl bg-[#f5f5f7] px-3 py-4 transition-all duration-200 hover:bg-white hover:ring-1 hover:ring-black/[0.06]"
              >
                {/* Dot + name */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${fuelDotColor[item.key] ?? defaultDotColor}`}
                    aria-hidden="true"
                  />
                  <span className="text-center text-xs font-bold leading-tight text-[#1d1d1f] sm:text-sm">
                    {shortName[item.key] ?? item.name}
                  </span>
                </div>

                {/* Price */}
                <span className="tabular-nums text-2xl font-extrabold leading-none tracking-tight text-[#1d1d1f] sm:text-3xl">
                  {item.price.toFixed(2)}
                </span>

                {/* Unit */}
                <span className="text-[11px] font-medium text-[#6e6e73]">{item.unit}</span>
              </div>
            ))}
          </div>
        ) : (
          !error && (
            <div className="flex flex-1 items-center justify-center text-sm text-[#6e6e73]">
              ไม่มีข้อมูลราคาน้ำมัน
            </div>
          )
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="border-t border-black/[0.05] pt-2">
          <span className="text-[10px] text-[#6e6e73]">แหล่งข้อมูล: EPPO</span>
        </div>
      </div>
    </section>
  )
}
