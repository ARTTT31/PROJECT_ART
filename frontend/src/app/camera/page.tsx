'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import {
  Camera,
  CameraOff,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Pencil,
  Video,
  Globe,
  Radio,
  Image as ImageIcon,
  Check,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { CameraStreamConfig, CameraStreamType } from '@/types'
import { showToast, showDeleteConfirm } from '@/utils/sweetalert'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'

const DEFAULT_STREAMS: CameraStreamConfig[] = [
  {
    id: '1',
    name: 'หน้าบ้าน (Front Entrance)',
    location: 'ภายนอก — ประตูหลัก',
    streamType: 'simulated',
    status: 'online',
    fps: 30,
    resolution: '1920x1080',
  },
  {
    id: '2',
    name: 'โรงจอดรถ (Garage)',
    location: 'ภายนอก — ลานจอดรถ',
    streamType: 'simulated',
    status: 'online',
    fps: 24,
    resolution: '1920x1080',
  },
  {
    id: '3',
    name: 'ห้องนั่งเล่น (Living Room)',
    location: 'ภายใน — ชั้น 1',
    streamType: 'simulated',
    status: 'online',
    fps: 30,
    resolution: '1280x720',
  },
  {
    id: '4',
    name: 'หลังบ้าน (Backyard)',
    location: 'ภายนอก — สวนหลังบ้าน',
    streamType: 'simulated',
    status: 'offline',
    fps: 0,
    resolution: 'N/A',
  },
]

export default function CameraPage() {
  const { user, updateUser } = useAuth()
  const [streams, setStreams] = useState<CameraStreamConfig[]>(DEFAULT_STREAMS)
  const [activeCameraId, setActiveCameraId] = useState<string>('1')
  const [refreshing, setRefreshing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [snapshotTicks, setSnapshotTicks] = useState<Record<string, number>>({})

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formStreamType, setFormStreamType] = useState<CameraStreamType>('simulated')
  const [formRefreshInterval, setFormRefreshInterval] = useState<number>(3)
  const [formFps, setFormFps] = useState<number>(30)
  const [formResolution, setFormResolution] = useState<string>('1920x1080')
  const [isSaving, setIsSaving] = useState(false)

  const videoContainerRef = useRef<HTMLDivElement>(null)

  // ── Load streams from user.camera_config or localStorage ──
  useEffect(() => {
    setIsClient(true)
    let loaded: CameraStreamConfig[] = DEFAULT_STREAMS

    if (user?.camera_config) {
      try {
        const parsed = JSON.parse(user.camera_config)
        if (Array.isArray(parsed) && parsed.length > 0) {
          loaded = parsed
        }
      } catch (e) {
        console.error('Failed to parse camera_config:', e)
      }
    } else {
      const saved = localStorage.getItem('artWorkspaceCameraConfig')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed
          }
        } catch {}
      }
    }

    setStreams(loaded)
    if (loaded.length > 0) {
      setActiveCameraId(loaded[0].id)
    }
  }, [user?.camera_config])

  // ── Persist streams helper ──
  const persistStreams = useCallback(
    async (nextStreams: CameraStreamConfig[]) => {
      setStreams(nextStreams)
      const payload = JSON.stringify(nextStreams)

      try {
        localStorage.setItem('artWorkspaceCameraConfig', payload)
      } catch {}

      try {
        await fetchWithAuth('/api/v1/profile/camera-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camera_config: payload }),
        })
        updateUser({ camera_config: payload })
      } catch (err) {
        console.error('Failed to sync camera config to backend:', err)
      }
    },
    [updateUser]
  )

  // ── Active camera object ──
  const activeCamera = streams.find((s) => s.id === activeCameraId) || streams[0]

  // ── Snapshot Interval Timer ──
  useEffect(() => {
    if (!activeCamera || activeCamera.streamType !== 'snapshot') return

    const intervalSec = activeCamera.refreshInterval || 3
    const timer = setInterval(() => {
      setSnapshotTicks((prev) => ({
        ...prev,
        [activeCamera.id]: (prev[activeCamera.id] || 0) + 1,
      }))
    }, intervalSec * 1000)

    return () => clearInterval(timer)
  }, [activeCamera])

  // ── Refresh Camera Status ──
  const handleRefresh = () => {
    setRefreshing(true)
    setSnapshotTicks((prev) => ({
      ...prev,
      [activeCamera?.id || '']: (prev[activeCamera?.id || ''] || 0) + 1,
    }))

    setTimeout(() => {
      setRefreshing(false)
      setStreams((prev) =>
        prev.map((s) => ({
          ...s,
          status: 'online',
          fps: s.fps || 30,
        }))
      )
      showToast('รีเฟรชสถานะกล้องทั้งหมดสำเร็จ', 'success')
    }, 1000)
  }

  // ── Fullscreen toggle ──
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch((err) => {
        console.error('Error entering fullscreen:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      }).catch((err) => {
        console.error('Error exiting fullscreen:', err)
      })
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ── Dialog Handlers ──
  const openAddDialog = () => {
    setEditingCameraId(null)
    setFormName('')
    setFormLocation('')
    setFormUrl('')
    setFormStreamType('simulated')
    setFormRefreshInterval(3)
    setFormFps(30)
    setFormResolution('1920x1080')
    setIsDialogOpen(true)
  }

  const openEditDialog = (cam: CameraStreamConfig) => {
    setEditingCameraId(cam.id)
    setFormName(cam.name)
    setFormLocation(cam.location)
    setFormUrl(cam.url || '')
    setFormStreamType(cam.streamType)
    setFormRefreshInterval(cam.refreshInterval || 3)
    setFormFps(cam.fps || 30)
    setFormResolution(cam.resolution || '1920x1080')
    setIsDialogOpen(true)
  }

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      showToast('กรุณาระบุชื่อกล้อง', 'warning')
      return
    }

    setIsSaving(true)
    try {
      let updated: CameraStreamConfig[]

      if (editingCameraId) {
        // Edit
        updated = streams.map((s) =>
          s.id === editingCameraId
            ? {
                ...s,
                name: formName.trim(),
                location: formLocation.trim() || 'ไม่ระบุตำแหน่ง',
                url: formUrl.trim(),
                streamType: formStreamType,
                refreshInterval: formRefreshInterval,
                fps: formFps,
                resolution: formResolution,
                status: 'online',
              }
            : s
        )
        showToast('อัปเดตข้อมูลกล้องสำเร็จ', 'success')
      } else {
        // Add new
        const newCam: CameraStreamConfig = {
          id: `cam-${Date.now()}`,
          name: formName.trim(),
          location: formLocation.trim() || 'ไม่ระบุตำแหน่ง',
          url: formUrl.trim(),
          streamType: formStreamType,
          refreshInterval: formRefreshInterval,
          fps: formFps,
          resolution: formResolution,
          status: 'online',
        }
        updated = [...streams, newCam]
        setActiveCameraId(newCam.id)
        showToast('เพิ่มกล้องวงจรปิดใหม่สำเร็จ', 'success')
      }

      await persistStreams(updated)
      setIsDialogOpen(false)
    } catch {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCamera = async (camId: string, camName: string) => {
    if (streams.length <= 1) {
      showToast('ต้องมีกล้องอย่างน้อย 1 ตัวในระบบ', 'warning')
      return
    }

    const confirm = await showDeleteConfirm('ต้องการลบกล้องนี้หรือไม่?', `ลบกล้อง "${camName}" ออกจากระบบ`)
    if (!confirm.isConfirmed) return

    const updated = streams.filter((s) => s.id !== camId)
    await persistStreams(updated)

    if (activeCameraId === camId) {
      setActiveCameraId(updated[0]?.id || '')
    }
    showToast('ลบกล้องสำเร็จ', 'success')
  }

  // ── Render Helpers ──
  const getStreamTypeLabel = (type: CameraStreamType) => {
    switch (type) {
      case 'snapshot':
        return 'ภาพนิ่ง Snapshot (Auto-refresh)'
      case 'mjpeg':
        return 'MJPEG / Web Stream'
      case 'iframe':
        return 'Web Embed / Lovelace NVR'
      case 'simulated':
        return 'โหมดจำลอง (Simulated Live)'
    }
  }

  if (!isClient) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
        </div>
      </DashboardLayout>
    )
  }

  const currentTick = snapshotTicks[activeCamera?.id || ''] || 0
  const currentSnapshotUrl =
    activeCamera?.streamType === 'snapshot' && activeCamera.url
      ? `${activeCamera.url}${activeCamera.url.includes('?') ? '&' : '?'}_t=${currentTick}`
      : activeCamera?.url

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5">
        {/* ── Page header ────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-5">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#1d1d1f]">
              กล้องวงจรปิด
            </h1>
            <p className="mt-0.5 text-sm text-[#6e6e73]">
              ระบบตรวจสอบความปลอดภัยและกล้องวงจรปิด ({streams.length} ตัวที่เชื่อมต่อ)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddDialog}
              className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(0,113,227,0.30)] transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_4px_12px_rgba(0,113,227,0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
              aria-label="เพิ่มกล้องใหม่"
            >
              <Plus size={15} aria-hidden="true" />
              เพิ่มกล้อง
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] hover:shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
              aria-label="รีเฟรชสถานะกล้อง"
            >
              <RefreshCw
                size={13}
                className={refreshing ? 'animate-spin text-[#0071e3]' : ''}
                aria-hidden="true"
              />
              รีเฟรชสถานะ
            </button>
          </div>
        </header>

        {/* ── Main layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Primary View Screen */}
          <div className="lg:col-span-2">
            <div
              ref={videoContainerRef}
              className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-black/[0.08] shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
            >
              {activeCamera?.status === 'online' ? (
                <div className="relative h-full w-full">
                  {/* Stream Renderer according to streamType */}
                  {activeCamera.streamType === 'snapshot' && activeCamera.url ? (
                    <div className="relative h-full w-full bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={currentTick}
                        src={currentSnapshotUrl}
                        alt={activeCamera.name}
                        className="h-full w-full object-contain"
                        onError={() => {
                          setStreams((prev) =>
                            prev.map((s) => (s.id === activeCamera.id ? { ...s, status: 'offline' } : s))
                          )
                        }}
                      />
                    </div>
                  ) : activeCamera.streamType === 'mjpeg' && activeCamera.url ? (
                    <div className="relative h-full w-full bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeCamera.url}
                        alt={activeCamera.name}
                        className="h-full w-full object-contain"
                        onError={() => {
                          setStreams((prev) =>
                            prev.map((s) => (s.id === activeCamera.id ? { ...s, status: 'offline' } : s))
                          )
                        }}
                      />
                    </div>
                  ) : activeCamera.streamType === 'iframe' && activeCamera.url ? (
                    <div className="relative h-full w-full bg-black">
                      <iframe
                        src={activeCamera.url}
                        title={activeCamera.name}
                        className="h-full w-full border-0"
                        allow="autoplay; fullscreen"
                      />
                    </div>
                  ) : (
                    /* Simulated Live Mode */
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Camera size={52} className="animate-pulse text-sky-400/50" aria-hidden="true" />
                        <span className="text-xs font-medium tracking-wide text-slate-400">
                          จำลองภาพสตรีมความละเอียด {activeCamera.resolution || '1080p'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* HUD Overlay */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                    {/* Top HUD Bar */}
                    <div className="pointer-events-auto flex items-center justify-between">
                      <span className="flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" aria-hidden="true" />
                        LIVE
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
                          {getStreamTypeLabel(activeCamera.streamType)}
                        </span>
                        <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
                          FPS: {activeCamera.fps || 30} &nbsp;|&nbsp; {activeCamera.resolution || '1080p'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom HUD Bar */}
                    <div className="pointer-events-auto z-10 -mx-4 -mb-4 mt-auto flex items-end justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-white">{activeCamera.name}</p>
                          <button
                            onClick={() => openEditDialog(activeCamera)}
                            className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            aria-label="แก้ไขข้อมูลกล้องนี้"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        <p className="text-xs text-white/70">{activeCamera.location}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleFullscreen}
                          className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                          aria-label={isFullscreen ? 'ย่อหน้าจอ' : 'ขยายเต็มจอ'}
                        >
                          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <CameraOff size={48} className="text-slate-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-300">
                      {activeCamera?.name || 'กล้อง'} ตัดการเชื่อมต่อ (Offline)
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ไม่สามารถเชื่อมต่อ URL ของกล้องได้ กรุณาตรวจสอบการตั้งค่าเครือข่ายหรือ URL สตรีม
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={handleRefresh}
                      className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      ลองใหม่
                    </button>
                    {activeCamera && (
                      <button
                        onClick={() => openEditDialog(activeCamera)}
                        className="rounded-full bg-[#0071e3] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0077ed]"
                      >
                        แก้ไขการตั้งค่า
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Camera List Sidebar */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-black/[0.06] shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-[#1d1d1f]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f5f5f7]">
                    <Shield size={15} className="text-[#1d1d1f]" aria-hidden="true" />
                  </div>
                  รายการกล้องทั้งหมด ({streams.length})
                </h2>
              </div>

              <ul className="flex flex-col gap-2" role="list">
                {streams.map((cam) => {
                  const isSelected = activeCamera?.id === cam.id
                  return (
                    <li key={cam.id} className="group relative">
                      <div
                        className={[
                          'flex w-full items-center justify-between rounded-xl p-3 text-left transition-all duration-150',
                          isSelected
                            ? 'bg-[#0071e3]/[0.07] ring-1 ring-[#0071e3]/25 shadow-[0_2px_8px_rgba(0,113,227,0.08)]'
                            : 'bg-[#f5f5f7] hover:bg-white hover:ring-1 hover:ring-black/[0.06] hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]',
                        ].join(' ')}
                      >
                        <button
                          onClick={() => setActiveCameraId(cam.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
                          aria-label={`${cam.name} — ${cam.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}`}
                        >
                          {/* Icon badge */}
                          <div
                            className={[
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
                              cam.status === 'online'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-600',
                            ].join(' ')}
                          >
                            {cam.status === 'online' ? (
                              <Camera size={15} aria-hidden="true" />
                            ) : (
                              <CameraOff size={15} aria-hidden="true" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                              {cam.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[#6e6e73]">
                              {cam.location}
                            </p>
                          </div>
                        </button>

                        {/* Action buttons / Status pill */}
                        <div className="flex items-center gap-1.5 pl-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(cam)
                            }}
                            className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-black/[0.05] hover:text-slate-700 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={`แก้ไข ${cam.name}`}
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCamera(cam.id, cam.name)
                            }}
                            className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={`ลบ ${cam.name}`}
                          >
                            <Trash2 size={13} />
                          </button>

                          <span
                            className={[
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              cam.status === 'online'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-600',
                            ].join(' ')}
                          >
                            {cam.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Add / Edit Camera Dialog ─────────────────────────────────── */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingCameraId ? 'แก้ไขข้อมูลกล้องวงจรปิด' : 'เพิ่มกล้องวงจรปิดใหม่'}
              </DialogTitle>
              <DialogDescription>
                กรอกรายละเอียดการเชื่อมต่อกล้องวงจรปิด ข้อมูลจะถูกบันทึกลงระบบคลาวด์อัตโนมัติ
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCamera}>
              <DialogBody className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    ชื่อกล้อง <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="เช่น หน้าบ้าน (Front Entrance)"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#0071e3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    ตำแหน่งที่ตั้ง
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="เช่น ภายนอก — ประตูหลัก"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#0071e3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    ประเภทการเชื่อมต่อ (Stream Type)
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {[
                      { type: 'snapshot' as const, label: 'Snapshot ภาพนิ่ง', icon: ImageIcon },
                      { type: 'mjpeg' as const, label: 'MJPEG สตรีม', icon: Video },
                      { type: 'iframe' as const, label: 'Web Embed / NVR', icon: Globe },
                      { type: 'simulated' as const, label: 'โหมดจำลอง', icon: Radio },
                    ].map((opt) => {
                      const Icon = opt.icon
                      const isChecked = formStreamType === opt.type
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => setFormStreamType(opt.type)}
                          className={[
                            'flex items-center gap-2 rounded-xl p-2.5 text-left text-xs font-medium transition-all',
                            isChecked
                              ? 'bg-[#0071e3]/10 font-semibold text-[#0071e3] ring-1 ring-[#0071e3]'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
                          ].join(' ')}
                        >
                          <Icon size={14} className={isChecked ? 'text-[#0071e3]' : 'text-slate-400'} />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {formStreamType !== 'simulated' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      URL สตรีม / Snapshot URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder={
                        formStreamType === 'snapshot'
                          ? 'http://192.168.1.50/snapshot.jpg'
                          : formStreamType === 'mjpeg'
                          ? 'http://192.168.1.50:8080/video.mjpg'
                          : 'https://homeassistant.local/lovelace/cctv'
                      }
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 transition-colors focus:border-[#0071e3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                    />
                  </div>
                )}

                {formStreamType === 'snapshot' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      รอบการรีเฟรชภาพนิ่ง (วินาที)
                    </label>
                    <select
                      value={formRefreshInterval}
                      onChange={(e) => setFormRefreshInterval(Number(e.target.value))}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#0071e3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                    >
                      <option value={1}>ทุก 1 วินาที (เร็ว)</option>
                      <option value={2}>ทุก 2 วินาที</option>
                      <option value={3}>ทุก 3 วินาที (แนะนำ)</option>
                      <option value={5}>ทุก 5 วินาที</option>
                      <option value={10}>ทุก 10 วินาที</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      ความละเอียด
                    </label>
                    <input
                      type="text"
                      value={formResolution}
                      onChange={(e) => setFormResolution(e.target.value)}
                      placeholder="1920x1080"
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#0071e3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      อัตราเฟรมเรต (FPS)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={formFps}
                      onChange={(e) => setFormFps(Number(e.target.value))}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#0071e3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
                    />
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0077ed] disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {editingCameraId ? 'บันทึกการแก้ไข' : 'เพิ่มกล้อง'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
