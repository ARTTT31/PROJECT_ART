'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { Camera, CameraOff, Maximize2, RefreshCw, Shield } from 'lucide-react'

interface CameraStream {
  id: string
  name: string
  location: string
  status: 'online' | 'offline'
  fps: number
  resolution: string
}

const INITIAL_STREAMS: CameraStream[] = [
  { id: '1', name: 'หน้าบ้าน (Front Entrance)',  location: 'ภายนอก — ประตูหลัก',   status: 'online',  fps: 30, resolution: '1920x1080' },
  { id: '2', name: 'โรงจอดรถ (Garage)',           location: 'ภายนอก — ลานจอดรถ',   status: 'online',  fps: 24, resolution: '1920x1080' },
  { id: '3', name: 'ห้องนั่งเล่น (Living Room)',  location: 'ภายใน — ชั้น 1',       status: 'online',  fps: 30, resolution: '1280x720' },
  { id: '4', name: 'หลังบ้าน (Backyard)',          location: 'ภายนอก — สวนหลังบ้าน', status: 'offline', fps: 0,  resolution: 'N/A' },
]

export default function CameraPage() {
  const [streams, setStreams]       = useState<CameraStream[]>(INITIAL_STREAMS)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCamera, setActiveCamera] = useState<string | null>('1')

  const active = streams.find((s) => s.id === activeCamera)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setStreams((prev) =>
        prev.map((s) =>
          s.id === '4' ? { ...s, status: 'online', fps: 15, resolution: '1280x720' } : s,
        ),
      )
    }, 1200)
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 p-4 sm:p-6">

        {/* ── Page header ────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-5">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">
              กล้องวงจรปิด
            </h1>
            <p className="mt-0.5 text-sm text-[#6e6e73]">
              ระบบตรวจสอบความปลอดภัยและกล้องวงจรปิดภายในบ้าน
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] hover:shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
            aria-label="รีเฟรชสถานะกล้อง"
          >
            <RefreshCw
              size={13}
              className={refreshing ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            รีเฟรชสถานะ
          </button>
        </header>

        {/* ── Main layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Primary view */}
          <div className="lg:col-span-2">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-black/[0.08]">
              {active?.status === 'online' ? (
                <>
                  {/* Simulated live frame */}
                  <div className="absolute inset-0 flex flex-col justify-between p-4">
                    {/* Top bar */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" aria-hidden="true" />
                        Live
                      </span>
                      <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        FPS: {active.fps} &nbsp;|&nbsp; {active.resolution}
                      </span>
                    </div>

                    {/* Centre placeholder */}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                      <Camera size={48} className="animate-pulse text-white/30" aria-hidden="true" />
                    </div>

                    {/* Bottom bar */}
                    <div className="z-10 -mx-4 -mb-4 mt-auto flex items-end justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                      <div>
                        <p className="text-base font-bold text-white">{active.name}</p>
                        <p className="text-xs text-white/70">{active.location}</p>
                      </div>
                      <button
                        className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        aria-label="ขยายเต็มจอ"
                      >
                        <Maximize2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <CameraOff size={44} className="text-slate-600" aria-hidden="true" />
                  <p className="font-semibold text-slate-300">กล้องตัดการเชื่อมต่อ (Offline)</p>
                  <p className="text-xs text-slate-500">กรุณาตรวจสอบระบบไฟหรือกดปุ่มรีเฟรชด้านบน</p>
                </div>
              )}
            </div>
          </div>

          {/* Camera list */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-black/[0.06]">
              <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-bold text-[#1d1d1f]">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f5f5f7]">
                  <Shield size={15} className="text-[#1d1d1f]" aria-hidden="true" />
                </div>
                สถานะกล้องทั้งหมด
              </h2>

              <div className="flex flex-col gap-2" role="list">
                {streams.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => setActiveCamera(cam.id)}
                    role="listitem"
                    aria-pressed={activeCamera === cam.id}
                    className={[
                      'flex items-center justify-between rounded-xl p-3 text-left transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1',
                      activeCamera === cam.id
                        ? 'bg-[#0071e3]/[0.07] ring-1 ring-[#0071e3]/20'
                        : 'bg-[#f5f5f7] hover:bg-white hover:ring-1 hover:ring-black/[0.06]',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon badge */}
                      <div className={[
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
                        cam.status === 'online'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-600',
                      ].join(' ')}>
                        {cam.status === 'online'
                          ? <Camera size={15} aria-hidden="true" />
                          : <CameraOff size={15} aria-hidden="true" />}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                          {cam.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#6e6e73]">
                          {cam.location}
                        </p>
                      </div>
                    </div>

                    {/* Status pill */}
                    <span className={[
                      'ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      cam.status === 'online'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-600',
                    ].join(' ')}>
                      {cam.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
