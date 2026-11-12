'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PageAccessGuard from '@/components/Auth/PageAccessGuard';
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
  Radio,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Select from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { CameraStreamConfig, CameraStreamType } from '@/types';
import { sanitizeCameraStreams, stripCameraCredentials } from '@/utils/cameraUrl';
import { showToast, showDeleteConfirm } from '@/utils/sweetalert';
import { useI18n, translateText } from '@/lib/i18n/I18nProvider';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

/**
 * Seed cameras for a workspace that has not saved a layout yet.
 *
 * Built at call time rather than kept as a module constant so the seeded names
 * follow the interface language; once the user edits a camera the names become
 * their own data and are stored as typed.
 */
function createDefaultStreams(): CameraStreamConfig[] {
  return [
    {
      id: '1',
      name: translateText('หน้าบ้าน', 'Front entrance'),
      location: translateText('ภายนอก — ประตูหลัก', 'Outside — main door'),
      streamType: 'simulated',
      status: 'online',
      fps: 30,
      resolution: '1920x1080',
    },
    {
      id: '2',
      name: translateText('โรงจอดรถ', 'Garage'),
      location: translateText('ภายนอก — ลานจอดรถ', 'Outside — parking area'),
      streamType: 'simulated',
      status: 'online',
      fps: 24,
      resolution: '1920x1080',
    },
    {
      id: '3',
      name: translateText('ห้องนั่งเล่น', 'Living room'),
      location: translateText('ภายใน — ชั้น 1', 'Inside — floor 1'),
      streamType: 'simulated',
      status: 'online',
      fps: 30,
      resolution: '1280x720',
    },
    {
      id: '4',
      name: translateText('หลังบ้าน', 'Backyard'),
      location: translateText('ภายนอก — สวนหลังบ้าน', 'Outside — back garden'),
      streamType: 'simulated',
      status: 'offline',
      fps: 0,
      resolution: 'N/A',
    },
  ];
}

export default function CameraPage() {
  const { user, updateUser } = useAuth();
  const { tr } = useI18n();
  const [streams, setStreams] = useState<CameraStreamConfig[]>(() => createDefaultStreams());
  const [activeCameraId, setActiveCameraId] = useState<string>('1');
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [snapshotTicks, setSnapshotTicks] = useState<Record<string, number>>({});

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formStreamType, setFormStreamType] = useState<CameraStreamType>('simulated');
  const [formRefreshInterval, setFormRefreshInterval] = useState<number>(3);
  const [formFps, setFormFps] = useState<number>(30);
  const [formResolution, setFormResolution] = useState<string>('1920x1080');
  const [isSaving, setIsSaving] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);

  // ── Load streams from user.camera_config or localStorage ──
  useEffect(() => {
    setIsClient(true);
    let loaded: CameraStreamConfig[] = createDefaultStreams();

    if (user?.camera_config) {
      try {
        const parsed = JSON.parse(user.camera_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // T16: migrate the removed iframe type and never resurrect stored credentials.
          loaded = sanitizeCameraStreams(parsed) as CameraStreamConfig[];
        }
      } catch (e) {
        console.error('Failed to parse camera_config:', e);
      }
    } else {
      const saved = localStorage.getItem('artWorkspaceCameraConfig');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = sanitizeCameraStreams(parsed) as CameraStreamConfig[];
          }
        } catch {}
      }
    }

    setStreams(loaded);
    if (loaded.length > 0) {
      setActiveCameraId(loaded[0].id);
    }
  }, [user?.camera_config]);

  // ── Persist streams helper ──
  const persistStreams = useCallback(
    async (nextStreams: CameraStreamConfig[]) => {
      setStreams(nextStreams);
      // T16: credentials typed into a camera URL are stripped before they are
      // ever written to localStorage or the users table.
      const payload = JSON.stringify(sanitizeCameraStreams(nextStreams));

      try {
        localStorage.setItem('artWorkspaceCameraConfig', payload);
      } catch {}

      try {
        await fetchWithAuth('/api/v1/profile/camera-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camera_config: payload }),
        });
        updateUser({ camera_config: payload });
      } catch (err) {
        console.error('Failed to sync camera config to backend:', err);
      }
    },
    [updateUser],
  );

  // ── Active camera object ──
  const activeCamera = streams.find((s) => s.id === activeCameraId) || streams[0];

  // ── Snapshot Interval Timer ──
  useEffect(() => {
    if (!activeCamera || activeCamera.streamType !== 'snapshot') return;

    const intervalSec = activeCamera.refreshInterval || 3;
    const timer = setInterval(() => {
      setSnapshotTicks((prev) => ({
        ...prev,
        [activeCamera.id]: (prev[activeCamera.id] || 0) + 1,
      }));
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [activeCamera]);

  // ── Refresh Camera Status ──
  const handleRefresh = () => {
    if (!activeCamera) return;
    setRefreshing(true);
    setSnapshotTicks((prev) => ({
      ...prev,
      [activeCamera.id]: (prev[activeCamera.id] || 0) + 1,
    }));

    setTimeout(() => {
      setRefreshing(false);
      setStreams((prev) =>
        prev.map((s) => ({
          ...s,
          status: 'online',
          fps: s.fps || 30,
        })),
      );
      showToast(tr('รีเฟรชสถานะกล้องทั้งหมดสำเร็จ', 'All camera statuses refreshed'), 'success');
    }, 1000);
  };

  // ── Fullscreen toggle ──
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      videoContainerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          console.error('Error entering fullscreen:', err);
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch((err) => {
          console.error('Error exiting fullscreen:', err);
        });
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Dialog Handlers ──
  const openAddDialog = () => {
    setEditingCameraId(null);
    setFormName('');
    setFormLocation('');
    setFormUrl('');
    setFormStreamType('simulated');
    setFormRefreshInterval(3);
    setFormFps(30);
    setFormResolution('1920x1080');
    setIsDialogOpen(true);
  };

  const openEditDialog = (cam: CameraStreamConfig) => {
    setEditingCameraId(cam.id);
    setFormName(cam.name);
    setFormLocation(cam.location);
    setFormUrl(cam.url || '');
    setFormStreamType(cam.streamType);
    setFormRefreshInterval(cam.refreshInterval || 3);
    setFormFps(cam.fps || 30);
    setFormResolution(cam.resolution || '1920x1080');
    setIsDialogOpen(true);
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast(tr('กรุณาระบุชื่อกล้อง', 'Enter a camera name'), 'warning');
      return;
    }

    setIsSaving(true);
    try {
      let updated: CameraStreamConfig[];

      if (editingCameraId) {
        // Edit
        updated = streams.map((s) =>
          s.id === editingCameraId
            ? {
                ...s,
                name: formName.trim(),
                location: formLocation.trim() || tr('ไม่ระบุตำแหน่ง', 'Location not specified'),
                url: formUrl.trim(),
                streamType: formStreamType,
                refreshInterval: formRefreshInterval,
                fps: formFps,
                resolution: formResolution,
                status: 'online',
              }
            : s,
        );
        showToast(tr('อัปเดตข้อมูลกล้องสำเร็จ', 'Camera updated'), 'success');
      } else {
        // Add new
        const newCam: CameraStreamConfig = {
          id: `cam-${Date.now()}`,
          name: formName.trim(),
          location: formLocation.trim() || tr('ไม่ระบุตำแหน่ง', 'Location not specified'),
          url: formUrl.trim(),
          streamType: formStreamType,
          refreshInterval: formRefreshInterval,
          fps: formFps,
          resolution: formResolution,
          status: 'online',
        };
        updated = [...streams, newCam];
        setActiveCameraId(newCam.id);
        showToast(tr('เพิ่มกล้องวงจรปิดใหม่สำเร็จ', 'Camera added'), 'success');
      }

      await persistStreams(updated);
      setIsDialogOpen(false);
    } catch {
      showToast(tr('เกิดข้อผิดพลาดในการบันทึก', 'Could not save the camera'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCamera = async (camId: string, camName: string) => {
    if (streams.length <= 1) {
      showToast(tr('ต้องมีกล้องอย่างน้อย 1 ตัวในระบบ', 'At least one camera must remain'), 'warning');
      return;
    }

    const confirm = await showDeleteConfirm(
      tr('ต้องการลบกล้องนี้หรือไม่?', 'Delete this camera?'),
      tr('ลบกล้อง "{name}" ออกจากระบบ', 'Remove camera "{name}" from the workspace', {
        name: camName,
      }),
    );
    if (!confirm.isConfirmed) return;

    const updated = streams.filter((s) => s.id !== camId);
    await persistStreams(updated);

    if (activeCameraId === camId) {
      setActiveCameraId(updated[0]?.id || '');
    }
    showToast(tr('ลบกล้องสำเร็จ', 'Camera deleted'), 'success');
  };

  // ── Render Helpers ──
  const getStreamTypeLabel = (type: CameraStreamType) => {
    switch (type) {
      case 'snapshot':
        return tr('ภาพนิ่ง Snapshot (Auto-refresh)', 'Snapshot (auto-refresh)');
      case 'mjpeg':
        return 'MJPEG / Web Stream';
      case 'iframe':
        return 'Web Embed / Lovelace NVR';
      case 'simulated':
        return tr('โหมดจำลอง (Simulated Live)', 'Simulated live');
    }
  };

  if (!isClient) {
    return (
      <>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--surface-grouped)] border-t-[var(--accent)]" />
        </div>
      </>
    );
  }

  const currentTick = snapshotTicks[activeCamera?.id || ''] || 0;
  const currentSnapshotUrl =
    activeCamera?.streamType === 'snapshot' && activeCamera.url
      ? `${activeCamera.url}${activeCamera.url.includes('?') ? '&' : '?'}_t=${currentTick}`
      : activeCamera?.url;

  return (
    <PageAccessGuard page="camera">
      <div className="flex flex-col gap-5">
        {/* ── Page header ────────────────────────────────────────────── */}
        <PageHeader
          title={tr('กล้องวงจรปิด', 'CCTV cameras')}
          subtitle={tr(
            'ดูภาพสดและจัดการรายการกล้องใน workspace',
            'Watch live video and manage the cameras in this workspace',
          )}
          actions={
            <div className="flex items-center gap-2">
            <button
              onClick={openAddDialog}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white  transition-all duration-150 hover:bg-[var(--accent-hover)]  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
              aria-label={tr('เพิ่มกล้องใหม่', 'Add a camera')}
            >
              <Plus size={15} aria-hidden="true" />
              {tr('เพิ่มกล้อง', 'Add camera')}
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)] transition-colors duration-150 hover:bg-[var(--surface-grouped)] disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
              aria-label={tr('รีเฟรชสถานะกล้อง', 'Refresh camera status')}
            >
              <RefreshCw
                size={13}
                className={refreshing ? 'animate-spin text-[var(--accent-text)]' : ''}
                aria-hidden="true"
              />
              {tr('รีเฟรชสถานะ', 'Refresh status')}
            </button>
            </div>
          }
        />

        {/* ── Main layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Primary View Screen */}
          <div className="lg:col-span-2">
            <div
              ref={videoContainerRef}
              className="relative aspect-video overflow-hidden rounded-apple-lg bg-slate-950 ring-1 ring-[var(--hairline)] shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
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
                            prev.map((s) =>
                              s.id === activeCamera.id ? { ...s, status: 'offline' } : s,
                            ),
                          );
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
                            prev.map((s) =>
                              s.id === activeCamera.id ? { ...s, status: 'offline' } : s,
                            ),
                          );
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
                        <Camera
                          size={52}
                          className="animate-pulse text-sky-400/50"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-medium tracking-wide text-slate-400">
                          {tr(
                            'จำลองภาพสตรีมความละเอียด {resolution}',
                            'Simulated stream at {resolution}',
                            { resolution: activeCamera.resolution || '1080p' },
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* HUD Overlay */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                    {/* Top HUD Bar */}
                    <div className="pointer-events-auto flex items-center justify-between">
                      <span className="flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                        <span
                          className="h-1.5 w-1.5 animate-ping rounded-full bg-[var(--surface)]"
                          aria-hidden="true"
                        />
                        LIVE
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
                          {getStreamTypeLabel(activeCamera.streamType)}
                        </span>
                        <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
                          FPS: {activeCamera.fps || 30} &nbsp;|&nbsp;{' '}
                          {activeCamera.resolution || '1080p'}
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
                            className="rounded-full bg-[var(--glass-20)] p-1 text-white hover:bg-[var(--glass-40)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
                            aria-label={tr('แก้ไขข้อมูลกล้องนี้', 'Edit this camera')}
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        <p className="text-xs text-white/70">{activeCamera.location}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleFullscreen}
                          className="rounded-full bg-[var(--glass-20)] p-2 text-white transition-colors hover:bg-[var(--glass-40)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60"
                          aria-label={
                            isFullscreen
                              ? tr('ย่อหน้าจอ', 'Exit full screen')
                              : tr('ขยายเต็มจอ', 'Enter full screen')
                          }
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
                      {activeCamera?.name || tr('กล้อง', 'Camera')}{' '}
                      {tr('ตัดการเชื่อมต่อ (Offline)', 'is offline')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tr(
                        'ไม่สามารถเชื่อมต่อ URL ของกล้องได้ กรุณาตรวจสอบการตั้งค่าเครือข่ายหรือ URL สตรีม',
                        'Cannot reach the camera URL. Check the network settings or the stream URL.',
                      )}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={handleRefresh}
                      className="rounded-full bg-[var(--glass-10)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--glass-20)]"
                    >
                      {tr('ลองใหม่', 'Try again')}
                    </button>
                    {activeCamera && (
                      <button
                        onClick={() => openEditDialog(activeCamera)}
                        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                      >
                        {tr('แก้ไขการตั้งค่า', 'Edit settings')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Camera List Sidebar */}
          <div className="flex flex-col gap-3">
            <div className="rounded-apple-lg bg-[var(--surface)] p-5 ring-1 ring-[var(--hairline)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-[var(--ink)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-apple-md bg-[var(--surface-grouped)]">
                    <Shield size={15} className="text-[var(--ink)]" aria-hidden="true" />
                  </div>
                  {tr('รายการกล้องทั้งหมด ({count})', 'All cameras ({count})', {
                    count: streams.length,
                  })}
                </h2>
              </div>

              <ul className="flex flex-col gap-2" role="list">
                {streams.map((cam) => {
                  const isSelected = activeCamera?.id === cam.id;
                  return (
                    <li key={cam.id} className="group relative">
                      <div
                        className={[
                          'flex w-full items-center justify-between rounded-apple-widget p-3 text-left transition-all duration-150',
                          isSelected
                            ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent-ring)]'
                            : 'bg-[var(--surface-grouped)] hover:bg-[var(--surface)] hover:ring-1 hover:ring-[var(--hairline)]',
                        ].join(' ')}
                      >
                        <button
                          onClick={() => setActiveCameraId(cam.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-apple-widget text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          aria-label={`${cam.name} — ${
                            cam.status === 'online'
                              ? tr('ออนไลน์', 'Online')
                              : tr('ออฟไลน์', 'Offline')
                          }`}
                        >
                          {/* Icon badge */}
                          <div
                            className={[
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md',
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
                            <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                              {cam.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                              {cam.location}
                            </p>
                          </div>
                        </button>

                        {/* Action buttons / Status pill */}
                        <div className="flex items-center gap-1.5 pl-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(cam);
                            }}
                            className="rounded-apple-md p-2 text-slate-400 opacity-0 transition-opacity hover:bg-[var(--surface-chip)] hover:text-slate-700 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] [@media(hover:none)]:opacity-100"
                            aria-label={tr('แก้ไข {name}', 'Edit {name}', { name: cam.name })}
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCamera(cam.id, cam.name);
                            }}
                            className="rounded-apple-md p-2 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--danger)] [@media(hover:none)]:opacity-100"
                            aria-label={tr('ลบ {name}', 'Delete {name}', { name: cam.name })}
                          >
                            <Trash2 size={13} />
                          </button>

                          <span
                            className={[
                              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              cam.status === 'online'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-600',
                            ].join(' ')}
                          >
                            {cam.status === 'online'
                              ? tr('ออนไลน์', 'Online')
                              : tr('ออฟไลน์', 'Offline')}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
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
                {editingCameraId
                  ? tr('แก้ไขข้อมูลกล้องวงจรปิด', 'Edit camera')
                  : tr('เพิ่มกล้องวงจรปิดใหม่', 'Add a camera')}
              </DialogTitle>
              <DialogDescription>
                {tr(
                  'กรอกรายละเอียดการเชื่อมต่อกล้องวงจรปิด ข้อมูลจะถูกบันทึกลงระบบคลาวด์อัตโนมัติ',
                  'Enter the camera connection details. They are saved to your account automatically.',
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCamera}>
              <DialogBody className="space-y-4">
                <div>
                  <label
                    htmlFor="camera-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {tr('ชื่อกล้อง', 'Camera name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="camera-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={tr('เช่น หน้าบ้าน (Front Entrance)', 'e.g. Front entrance')}
                    className="mt-1 block w-full rounded-apple-widget border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="camera-location"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {tr('ตำแหน่งที่ตั้ง', 'Location')}
                  </label>
                  <input
                    id="camera-location"
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder={tr('เช่น ภายนอก — ประตูหลัก', 'e.g. Outside — main door')}
                    className="mt-1 block w-full rounded-apple-widget border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[var(--ink-secondary)]">
                    {tr('ประเภทการเชื่อมต่อ (Stream Type)', 'Connection type (stream type)')}
                  </span>
                  <SegmentedControl
                    label={tr('ประเภทการเชื่อมต่อ (Stream Type)', 'Connection type (stream type)')}
                    className="mt-1.5"
                    fullWidth
                    value={formStreamType}
                    onChange={setFormStreamType}
                    options={[
                      { value: 'snapshot', label: tr('ภาพนิ่ง', 'Snapshot') },
                      { value: 'mjpeg', label: 'MJPEG' },
                      { value: 'simulated', label: tr('จำลอง', 'Simulated') },
                    ]}
                  />
                </div>

                {formStreamType !== 'simulated' && (
                  <div>
                    <label
                      htmlFor="camera-url"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {tr('URL สตรีม / Snapshot URL', 'Stream URL / snapshot URL')}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="camera-url"
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
                      className="mt-1 block w-full rounded-apple-widget border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                  </div>
                )}

                {formStreamType === 'snapshot' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {tr('รอบการรีเฟรชภาพนิ่ง (วินาที)', 'Snapshot refresh interval (seconds)')}
                    </label>
                    <Select
                      ariaLabel={tr(
                        'รอบการรีเฟรชภาพนิ่ง (วินาที)',
                        'Snapshot refresh interval (seconds)',
                      )}
                      value={String(formRefreshInterval)}
                      onChange={(next) => setFormRefreshInterval(Number(next))}
                      size="md"
                      options={[
                        { value: '1', label: tr('ทุก 1 วินาที (เร็ว)', 'Every 1 second (fast)') },
                        { value: '2', label: tr('ทุก 2 วินาที', 'Every 2 seconds') },
                        {
                          value: '3',
                          label: tr('ทุก 3 วินาที (แนะนำ)', 'Every 3 seconds (recommended)'),
                        },
                        { value: '5', label: tr('ทุก 5 วินาที', 'Every 5 seconds') },
                        { value: '10', label: tr('ทุก 10 วินาที', 'Every 10 seconds') },
                      ]}
                      className="mt-1 w-full"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="camera-resolution"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {tr('ความละเอียด', 'Resolution')}
                    </label>
                    <input
                      id="camera-resolution"
                      type="text"
                      value={formResolution}
                      onChange={(e) => setFormResolution(e.target.value)}
                      placeholder="1920x1080"
                      className="mt-1 block w-full rounded-apple-widget border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="camera-fps"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {tr('อัตราเฟรมเรต (FPS)', 'Frame rate (FPS)')}
                    </label>
                    <input
                      id="camera-fps"
                      type="number"
                      min={1}
                      max={60}
                      value={formFps}
                      onChange={(e) => setFormFps(Number(e.target.value))}
                      className="mt-1 block w-full rounded-apple-widget border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
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
                  {tr('ยกเลิก', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {editingCameraId ? tr('บันทึกการแก้ไข', 'Save changes') : tr('เพิ่มกล้อง', 'Add camera')}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageAccessGuard>
  );
}
