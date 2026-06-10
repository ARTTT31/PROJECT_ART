'use client'

import { useEffect, useState } from 'react'
import { Fuel, AlertCircle } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { apiClient } from '@/lib/api/client'

interface OilPrice {
  key: string
  name: string
  price: number
  unit: string
  icon: string
}

interface OilPriceData {
  success: boolean
  prices: OilPrice[]
  update_date: string
  source: string
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
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchPrices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/oil-prices/oil-prices')
      const result = res.data
      if (result.success && result.prices) {
        setData(result)
      } else {
        setError('ไม่สามารถดึงข้อมูลราคาน้ำมันได้')
      }
      setLastUpdate(new Date())
    } catch (err: any) {
      console.error('Oil price fetch error:', err)
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 300000) // every 5 minutes
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}

          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs font-medium">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Card Grid ── */}
        {data && data.prices.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
            {[...data.prices].sort((a, b) => {
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
          <span className="text-[10px] text-slate-400">แหล่งข้อมูล: กรมธุรกิจพลังงาน (EPPO)</span>
        </div>
      </div>
    </section>
  )
}