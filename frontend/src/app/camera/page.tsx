'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { Camera, CameraOff, RefreshCw, Maximize2, Shield, Eye } from 'lucide-react'

interface CameraStream {
  id: string
  name: string
  location: string
  status: 'online' | 'offline'
  fps: number
  resolution: string
}

export default function CameraPage() {
  const [streams, setStreams] = useState<CameraStream[]>([
    { id: '1', name: 'หน้าบ้าน (Front Entrance)', location: 'ภายนอก - ประตูหลัก', status: 'online', fps: 30, resolution: '1920x1080' },
    { id: '2', name: 'โรงจอดรถ (Garage)', location: 'ภายนอก - ลานจอดรถ', status: 'online', fps: 24, resolution: '1920x1080' },
    { id: '3', name: 'ห้องนั่งเล่น (Living Room)', location: 'ภายใน - ชั้น 1', status: 'online', fps: 30, resolution: '1280x720' },
    { id: '4', name: 'หลังบ้าน (Backyard)', location: 'ภายนอก - สวนหลังบ้าน', status: 'offline', fps: 0, resolution: 'N/A' },
  ])
  const [refreshing, setRefreshing] = useState(false)
  const [activeCamera, setActiveCamera] = useState<string | null>('1')

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      // Simulate fixing a camera
      setStreams(prev => prev.map(s => s.id === '4' ? { ...s, status: 'online', fps: 15, resolution: '1280x720' } : s))
    }, 1200)
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">กล้องวงจรปิด</h1>
            <p className="mt-1 text-slate-500">ระบบตรวจสอบความปลอดภัยและกล้องวงจรปิดภายในบ้าน</p>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>รีเฟรชสถานะ</span>
          </button>
        </header>

        {/* Main Camera View */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="relative aspect-video overflow-hidden rounded-[var(--art-radius-lg)] border border-slate-200 bg-slate-950 shadow-md">
              {streams.find(s => s.id === activeCamera)?.status === 'online' ? (
                <>
                  {/* Simulated Stream Background Video/Animation placeholder */}
                  <div className="absolute inset-0 flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                        <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                        Live
                      </span>
                      <span className="rounded-lg bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        FPS: {streams.find(s => s.id === activeCamera)?.fps} | {streams.find(s => s.id === activeCamera)?.resolution}
                      </span>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                      <Camera size={48} className="animate-pulse text-white/40" />
                    </div>

                    <div className="z-10 mt-auto flex items-end justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 -mx-4 -mb-4">
                      <div>
                        <p className="font-bold text-white text-base">{streams.find(s => s.id === activeCamera)?.name}</p>
                        <p className="text-xs text-white/70">{streams.find(s => s.id === activeCamera)?.location}</p>
                      </div>
                      <button className="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 transition">
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <CameraOff size={48} className="text-slate-600" />
                  <p className="font-semibold text-slate-300">กล้องตัดการเชื่อมต่อ (Offline)</p>
                  <p className="text-xs text-slate-500">กรุณาตรวจสอบระบบไฟหรือกดปุ่มรีเฟรชด้านบน</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Info & List */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--art-radius-lg)] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-4">
                <Shield size={20} className="text-sky-500" />
                <span>สถานะกล้องทั้งหมด</span>
              </h2>
              <div className="flex flex-col gap-3">
                {streams.map(cam => (
                  <button
                    key={cam.id}
                    onClick={() => setActiveCamera(cam.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition text-left ${
                      activeCamera === cam.id
                        ? 'border-sky-500 bg-sky-50/50 text-sky-950 font-medium'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${cam.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {cam.status === 'online' ? <Camera size={16} /> : <CameraOff size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{cam.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{cam.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-xs uppercase font-bold text-slate-500">
                        {cam.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </div>
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
