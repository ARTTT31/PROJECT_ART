'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Database, Cpu, MemoryStick, HardDrive, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api/client'

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down'
  latency_ms?: number
  detail?: string
}

interface SystemHealth {
  uptime_seconds: number
  database: ServiceStatus
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  disk_percent: number
}

type HealthCache = { savedAt: number; data: SystemHealth; lastUpdate: number }
const HEALTH_CACHE_KEY = 'artSystemHealthCacheV1'
const HEALTH_CACHE_TTL_MS = 2 * 60_000 // 2 นาที

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function loadHealthCache(): HealthCache | null {
  const cached = safeJsonParse<HealthCache>(typeof window !== 'undefined' ? localStorage.getItem(HEALTH_CACHE_KEY) : null)
  if (!cached || !cached.savedAt || !cached.data) return null
  return cached
}

function saveHealthCache(cache: HealthCache) {
  try {
    localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}ว ${h}ชม`
  if (h > 0) return `${h}ชม ${m}นาที`
  return `${m} นาที`
}

function StatusIcon({ status }: { status: 'ok' | 'degraded' | 'down' }) {
  if (status === 'ok') return <CheckCircle size={14} className="text-emerald-500" />
  if (status === 'degraded') return <AlertTriangle size={14} className="text-amber-500" />
  return <XCircle size={14} className="text-red-500" />
}

function UsageBar({ value, label, colorClass }: { value: number; label: string; colorClass: string }) {
  const alertColor = value >= 90 ? 'text-red-600' : value >= 70 ? 'text-amber-600' : 'text-slate-700'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${alertColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default function SystemHealthWidget() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [cacheNote, setCacheNote] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/system/health')
      setHealth(res.data)
      setLastUpdate(new Date())
      setCacheNote(null)
      saveHealthCache({ savedAt: Date.now(), data: res.data, lastUpdate: Date.now() })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ไม่สามารถดึงข้อมูลระบบได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cached = loadHealthCache()
    if (cached && Date.now() - cached.savedAt <= HEALTH_CACHE_TTL_MS) {
      setHealth(cached.data)
      setLastUpdate(new Date(cached.lastUpdate || cached.savedAt))
      setCacheNote('แสดงข้อมูลจากแคช')
      setLoading(false)
    }
    fetchHealth()
    const id = setInterval(fetchHealth, 30_000)
    return () => clearInterval(id)
  }, [fetchHealth])

  return (
    <section className="premium-card !rounded-[14px] h-full flex flex-col" aria-labelledby="syshealth-title">
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-100/80 text-violet-700">
              <Activity size={18} />
            </div>
            <div>
              <h3 id="syshealth-title" className="text-base font-bold text-slate-900 tracking-tight">
                System Health
              </h3>
              <p className="text-[11px] text-slate-500">
                อัปเดต {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </p>
              {cacheNote && <p className="text-[11px] text-slate-500">{cacheNote}</p>}
            </div>
          </div>
          <button
            onClick={fetchHealth}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition"
            aria-label="รีเฟรช"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs font-medium">
            <XCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {health && (
          <div className="flex flex-col gap-3">
            {/* Uptime + DB row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-500 tracking-wide">เวลาทำงาน</span>
                <span className="text-sm font-bold text-slate-800">{formatUptime(health.uptime_seconds)}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Database size={11} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wide">ฐานข้อมูล</span>
                  <StatusIcon status={health.database.status} />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {health.database.latency_ms != null ? `${health.database.latency_ms} ms` : health.database.status}
                </span>
              </div>
            </div>

            {/* Resource bars */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <UsageBar value={health.cpu_percent} label="CPU" colorClass="bg-violet-400" />
              <UsageBar
                value={health.memory_percent}
                label={`RAM (${health.memory_used_mb.toFixed(0)} / ${health.memory_total_mb.toFixed(0)} MB)`}
                colorClass="bg-sky-400"
              />
              <UsageBar value={health.disk_percent} label="Disk" colorClass="bg-emerald-400" />
            </div>
          </div>
        )}

        {loading && !health && (
          <div className="flex-1 flex flex-col gap-2 animate-pulse">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 rounded-xl bg-slate-100" />
              <div className="h-14 rounded-xl bg-slate-100" />
            </div>
            <div className="h-24 rounded-xl bg-slate-100" />
          </div>
        )}
      </div>
    </section>
  )
}
