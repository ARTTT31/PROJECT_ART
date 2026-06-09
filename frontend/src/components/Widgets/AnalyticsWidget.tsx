'use client'

import { useEffect, useState } from 'react'
import { BarChart3, RotateCw, Sparkles, TrendingUp } from 'lucide-react'

interface AnalyticsWidgetProps {
  width?: number
  onResize?: (newSize: number) => void
}

export default function AnalyticsWidget({ width = 2, onResize }: AnalyticsWidgetProps) {
  const [stats, setStats] = useState({
    logins: 24,
    tasksCompleted: 15,
    activeDays: 6,
  })

  // Simulated chart data
  const chartData = [12, 19, 15, 8, 22, 14, 25]
  const labels = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
  
  // Calculate SVG dimensions
  const chartHeight = 100
  const chartWidth = 360
  const padding = 20
  
  const points = chartData.map((val, i) => {
    const x = padding + (i * (chartWidth - padding * 2)) / (chartData.length - 1)
    const maxVal = Math.max(...chartData)
    const y = chartHeight - padding - (val * (chartHeight - padding * 2)) / maxVal
    return { x, y }
  })

  const polylinePath = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className={`premium-card flex flex-col h-full bg-white/90 backdrop-blur-xl border border-white/40 shadow-glass-xl rounded-[28px] overflow-hidden ${
      width === 2 ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
    }`}>
      {/* Header */}
      <div className={`flex flex-col gap-3 mb-4 ${
        width >= 2 ? 'sm:flex-row sm:items-center sm:justify-between' : ''
      }`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 flex-shrink-0 ${
            width === 2 ? 'p-1.5' : ''
          }`}>
            <BarChart3 size={width === 2 ? 16 : 20} />
          </div>
          <div className="min-w-0">
            <h3 className={`font-bold text-slate-800 ${
              width === 2 ? 'text-sm' : 'text-base'
            }`}>ประสิทธิภาพและการใช้งาน</h3>
            <p className={`text-slate-500 font-semibold ${
              width === 2 ? 'text-[10px]' : 'text-[11px]'
            }`}>สถิติการใช้งานสัปดาห์นี้</p>
          </div>
        </div>

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
            <button
              onClick={() => onResize(2)}
              className={`relative flex items-center justify-center rounded-full text-xs font-extrabold transition-all duration-250 min-w-0 min-h-0 ${
                width === 2 ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-800'
              }`}
              style={{
                padding: '6px 14px',
                minWidth: '32px',
                height: '28px',
              }}
              aria-label="ขนาดกลาง"
              title="Medium (M)"
            >
              M
            </button>
            <button
              onClick={() => onResize(3)}
              className={`relative flex items-center justify-center rounded-full text-xs font-extrabold transition-all duration-250 min-w-0 min-h-0 ${
                width === 3 ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-800'
              }`}
              style={{
                padding: '6px 14px',
                minWidth: '32px',
                height: '28px',
              }}
              aria-label="ขนาดใหญ่"
              title="Large (L)"
            >
              L
            </button>
          </div>
        )}
      </div>

      {/* Grid Content - responsive columns */}
      <div className={`grid gap-2 mb-4 sm:mb-6 ${
        width === 2 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'
      }`}>
        <div className="bg-slate-50/50 p-2 sm:p-3.5 rounded-2xl border border-slate-100 text-center">
          <div className={`font-bold text-slate-400 uppercase tracking-wider ${
            width === 2 ? 'text-[9px]' : 'text-[10px]'
          }`}>ล็อกอิน</div>
          <div className={`font-extrabold text-slate-800 mt-0.5 ${
            width === 2 ? 'text-lg' : 'text-xl'
          }`}>{stats.logins}</div>
        </div>
        <div className="bg-slate-50/50 p-2 sm:p-3.5 rounded-2xl border border-slate-100 text-center">
          <div className={`font-bold text-slate-400 uppercase tracking-wider ${
            width === 2 ? 'text-[9px]' : 'text-[10px]'
          }`}>งานที่เสร็จ</div>
          <div className={`font-extrabold text-emerald-600 mt-0.5 ${
            width === 2 ? 'text-lg' : 'text-xl'
          }`}>{stats.tasksCompleted}</div>
        </div>
        <div className="bg-slate-50/50 p-2 sm:p-3.5 rounded-2xl border border-slate-100 text-center">
          <div className={`font-bold text-slate-400 uppercase tracking-wider ${
            width === 2 ? 'text-[9px]' : 'text-[10px]'
          }`}>วันที่ใช้งาน</div>
          <div className={`font-extrabold text-indigo-600 mt-0.5 ${
            width === 2 ? 'text-lg' : 'text-xl'
          }`}>{stats.activeDays} <span className={`font-normal text-slate-400 ${
            width === 2 ? 'text-[9px]' : 'text-[10px]'
          }`}>วัน</span></div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className={`relative flex-1 bg-gradient-to-b from-indigo-50/20 to-sky-50/10 border border-slate-100/50 rounded-2xl p-3 sm:p-4 flex flex-col justify-end ${
        width === 2 ? 'min-h-[120px]' : 'min-h-[140px]'
      }`}>
        <div className={`absolute top-2 left-3 sm:top-4 sm:left-4 flex items-center gap-1.5 font-semibold text-slate-600 ${
          width === 2 ? 'text-[11px]' : 'text-xs'
        }`}>
          <TrendingUp size={width === 2 ? 12 : 14} className="text-emerald-500 flex-shrink-0" />
          <span>อัตราความกระตือรือร้น (+14%)</span>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
          {/* Grids */}
          <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
          <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#f1f5f9" strokeWidth={1} />
          <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#f1f5f9" strokeWidth={1} />

          {/* Area under curve */}
          <path
            d={`M ${points[0].x} ${chartHeight - padding} ${points.map(p => `L ${p.x} ${p.y}`).join(' ')} L ${points[points.length - 1].x} ${chartHeight - padding} Z`}
            fill="url(#indigoGrad)"
            opacity={0.15}
          />

          {/* Sparkline */}
          <polyline
            fill="none"
            stroke="url(#gradientLine)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePath}
          />

          {/* Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              className="fill-indigo-600 stroke-white stroke-[2px]"
            />
          ))}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradientLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
        </svg>

        {/* Labels */}
        <div className={`flex justify-between px-2 sm:px-4 mt-1 sm:mt-2 font-bold text-slate-400 ${
          width === 2 ? 'text-[9px]' : 'text-[10px]'
        }`}>
          {labels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
