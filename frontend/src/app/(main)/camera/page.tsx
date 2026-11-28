'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PageAccessGuard from '@/components/Auth/PageAccessGuard';
import {
  Camera,
  CameraOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Pencil,
  Check,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Select from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import HlsPlayer, { type HlsPlayerState } from '@/components/Camera/HlsPlayer';
import { configuredCctvStreams } from '@/config/cctvStreams';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { CameraStreamConfig, CameraStreamType } from '@/types';
import { sanitizeCameraStreams, stripCameraCredentials } from '@/utils/cameraUrl';
import { scopedStorageKey } from '@/lib/offline/localStore';
import { showToast, showDeleteConfirm } from '@/utils/sweetalert';
import { useI18n } from '@/lib/i18n/I18nProvider';
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
  // Return deployment-managed streams if configured; otherwise start empty
  // instead of seeding simulated demo cameras.
  return configuredCctvStreams();
}

type DialogStreamMode = CameraStreamType | 'rtsp';
type RtspPreset = 'tapo' | 'hikvision' | 'dahua' | 'reolink' | 'custom';

interface BackendUserCamera {
  id: number;
  stream_key: string;
  name: string;
  location: string;
  preset: string;
  masked_host: string;
  hls_url: string;
  codec?: string | null;
  resolution?: string | null;
  fps?: number | null;
}

interface ProbeResult {
  reachable: boolean;
  authenticated: boolean;
  codec?: string | null;
  resolution?: string | null;
  warning?: string | null;
  error?: string | null;
}

const RTSP_PRESET_PATHS: Record<RtspPreset, string> = {
  tapo: '/stream2',
  hikvision: '/Streaming/Channels/102',
  dahua: '/cam/realmonitor?channel=1&subtype=1',
  reolink: '/h264Preview_01_sub',
  custom: '/stream2',
};

function mapManagedCamera(cam: BackendUserCamera): CameraStreamConfig {
  return {
    id: `rtsp:${cam.id}`,
    managedId: cam.id,
    name: cam.name,
    location: cam.location || cam.masked_host,
    url: cam.hls_url,
    streamType: 'hls',
    status: 'online',
    fps: cam.fps ?? 25,
    resolution: cam.resolution ?? '1280x720',
    maskedHost: cam.masked_host,
    codec: cam.codec ?? null,
  };
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
  // HLS has no server-side status endpoint; the player reports what it sees.
  const [streamRefreshKeys, setStreamRefreshKeys] = useState<Record<string, number>>({});
  const [streamEnabled, setStreamEnabled] = useState<Record<string, boolean>>({});
  const [hlsStates, setHlsStates] = useState<Record<string, HlsPlayerState>>({});
  const [singleViewMode, setSingleViewMode] = useState(true);

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formStreamType, setFormStreamType] = useState<DialogStreamMode>('rtsp');
  const [formPreset, setFormPreset] = useState<RtspPreset>('tapo');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState<number>(554);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRtspPath, setFormRtspPath] = useState('/stream2');
  const [probeState, setProbeState] = useState<ProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [formRefreshInterval, setFormRefreshInterval] = useState<number>(3);
  const [formFps, setFormFps] = useState<number>(25);
  const [formResolution, setFormResolution] = useState<string>('1280x720');
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
      // Account-scoped: the old bare key survived logout, so the next person on
      // this browser inherited the previous account's cameras. Read the legacy
      // key once, move it under the account, then delete it.
      const legacyKey = 'artWorkspaceCameraConfig';
      const saved = localStorage.getItem(scopedStorageKey('camera-config'));
      const legacy = saved ? null : localStorage.getItem(legacyKey);
      if (!saved && legacy) {
        try {
          localStorage.setItem(scopedStorageKey('camera-config'), legacy);
          localStorage.removeItem(legacyKey);
        } catch {}
      }
      const stored = saved ?? legacy;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = sanitizeCameraStreams(parsed) as CameraStreamConfig[];
          }
        } catch {}
      }
    }

    let cancelled = false;

    const loadAll = async () => {
      let managed: CameraStreamConfig[] = [];
      try {
        const res = await fetchWithAuth('/api/v1/cameras');
        if (res.ok) {
          const body = await res.json();
          const list = body?.data?.cameras;
          if (Array.isArray(list)) {
            managed = list.map(mapManagedCamera);
          }
        }
      } catch (err) {
        console.error('Failed to fetch managed cameras:', err);
      }
      if (cancelled) return;

      // Keep managed cameras paused on initial load so bandwidth/CPU stays low
      // until the user clicks Play on the camera they want to watch.
      if (managed.length > 0) {
        setStreamEnabled((prev) => {
          const next = { ...prev };
          for (const cam of managed) {
            if (next[cam.id] === undefined) next[cam.id] = false;
          }
          return next;
        });
      }

      const combined = [...managed, ...loaded];
      setStreams(combined);
      if (combined.length > 0) {
        setActiveCameraId((prev) =>
          combined.some((c) => c.id === prev) ? prev : combined[0].id,
        );
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [user?.camera_config]);

  // ── Persist local/legacy streams helper (managed RTSP cameras stay in /api/v1/cameras) ──
  const persistStreams = useCallback(
    async (nextStreams: CameraStreamConfig[]) => {
      setStreams(nextStreams);
      const localOnly = nextStreams.filter((s) => !s.managedId);
      // T16: credentials typed into a camera URL are stripped before they are
      // ever written to localStorage or the users table.
      const payload = JSON.stringify(sanitizeCameraStreams(localOnly));

      try {
        localStorage.setItem(scopedStorageKey('camera-config'), payload);
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
  const activeStreamEnabled = activeCamera ? streamEnabled[activeCamera.id] !== false : false;
  const activeRefreshKey = activeCamera ? (streamRefreshKeys[activeCamera.id] ?? 0) : 0;
  const activeHlsState =
    activeCamera?.streamType === 'hls' ? hlsStates[activeCamera.id] : undefined;

  const handleHlsState = useCallback((cameraId: string, next: HlsPlayerState) => {
    setHlsStates((prev) => (prev[cameraId] === next ? prev : { ...prev, [cameraId]: next }));
  }, []);

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
    setStreamRefreshKeys((prev) => {
      const next = { ...prev };
      for (const camera of streams) next[camera.id] = (next[camera.id] ?? 0) + 1;
      return next;
    });
    // HLS status comes from the player, not a synthetic online flag.
    setStreams((prev) =>
      prev.map((camera) =>
        camera.streamType === 'hls'
          ? camera
          : { ...camera, status: 'online', fps: camera.fps || 30 },
      ),
    );

    setTimeout(() => {
      setRefreshing(false);
      showToast(tr('กำลังเชื่อมต่อกล้องใหม่...', 'Reconnecting the cameras…'), 'success');
    }, 800);
  };

  const refreshCamera = useCallback((cameraId: string) => {
    setRefreshing(true);
    setStreamRefreshKeys((prev) => ({ ...prev, [cameraId]: (prev[cameraId] ?? 0) + 1 }));
    setStreamEnabled((prev) => ({ ...prev, [cameraId]: true }));
    setSnapshotTicks((prev) => ({ ...prev, [cameraId]: (prev[cameraId] ?? 0) + 1 }));
    window.setTimeout(() => setRefreshing(false), 800);
  }, []);

  const toggleStream = useCallback(
    async (cameraId: string) => {
      const target = streams.find((s) => s.id === cameraId);
      const willEnable = streamEnabled[cameraId] === false;

      if (willEnable && target?.managedId) {
        try {
          await fetchWithAuth(`/api/v1/cameras/${target.managedId}/activate`, {
            method: 'POST',
          });
        } catch (err) {
          console.error('Failed to activate MediaMTX path:', err);
        }
      }

      setStreamEnabled((prev) => {
        const next: Record<string, boolean> = singleViewMode && willEnable ? {} : { ...prev };
        if (singleViewMode && willEnable) {
          for (const cam of streams) {
            if (cam.streamType === 'hls' && cam.id !== cameraId) {
              next[cam.id] = false;
            }
          }
        }
        next[cameraId] = willEnable;
        return next;
      });
      setHlsStates((prev) => ({
        ...prev,
        [cameraId]: willEnable ? 'idle' : 'paused',
      }));
    },
    [streams, streamEnabled, singleViewMode],
  );

  const selectCamera = useCallback(
    (camId: string) => {
      setActiveCameraId(camId);
      if (singleViewMode) {
        setStreamEnabled((prev) => {
          const next = { ...prev };
          for (const s of streams) {
            if (s.streamType === 'hls' && s.id !== camId) {
              next[s.id] = false;
            }
          }
          return next;
        });
      }
    },
    [singleViewMode, streams],
  );

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
    setFormStreamType('rtsp');
    setFormPreset('tapo');
    setFormHost('');
    setFormPort(554);
    setFormUsername('');
    setFormPassword('');
    setFormRtspPath('/stream2');
    setProbeState(null);
    setFormRefreshInterval(3);
    setFormFps(25);
    setFormResolution('1280x720');
    setIsDialogOpen(true);
  };

  const openEditDialog = (cam: CameraStreamConfig) => {
    setEditingCameraId(cam.id);
    setFormName(cam.name);
    setFormLocation(cam.location);
    setFormUrl(cam.url || '');
    setFormStreamType(cam.streamType);
    setProbeState(null);
    setFormRefreshInterval(cam.refreshInterval || 3);
    setFormFps(cam.fps || 30);
    setFormResolution(cam.resolution || '1920x1080');
    setIsDialogOpen(true);
  };

  const handleProbeRtsp = async () => {
    if (!formHost.trim() && !formUrl.trim()) {
      showToast(tr('กรุณากรอก Host / DDNS ก่อนทดสอบ', 'Enter Host / DDNS first'), 'warning');
      return;
    }
    setIsProbing(true);
    setProbeState(null);
    try {
      const payload =
        formPreset === 'custom' && formUrl.trim().startsWith('rtsp')
          ? { rtsp_url: formUrl.trim() }
          : {
              host: formHost.trim(),
              port: formPort || 554,
              username: formUsername,
              password: formPassword,
              path: formRtspPath.trim() || '/stream2',
            };
      const res = await fetchWithAuth('/api/v1/cameras/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setProbeState({
          reachable: false,
          authenticated: false,
          error: body?.detail || tr('ทดสอบไม่สำเร็จ', 'Probe failed'),
        });
        return;
      }
      const probe = body?.data as ProbeResult;
      setProbeState(probe);
      if (probe.resolution) setFormResolution(probe.resolution);
      if (probe.error) {
        showToast(probe.error, 'error');
      } else if (probe.warning) {
        showToast(probe.warning, 'warning');
      } else {
        showToast(tr('เชื่อมต่อกล้องสำเร็จ พร้อมใช้งาน!', 'Camera reachable and ready!'), 'success');
      }
    } catch {
      setProbeState({
        reachable: false,
        authenticated: false,
        error: tr('ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อทดสอบได้', 'Could not reach server for probe'),
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast(tr('กรุณาระบุชื่อกล้อง', 'Enter a camera name'), 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (!editingCameraId && formStreamType === 'rtsp') {
        const payload =
          formPreset === 'custom' && formUrl.trim().startsWith('rtsp')
            ? {
                name: formName.trim(),
                location: formLocation.trim(),
                preset: formPreset,
                rtsp_url: formUrl.trim(),
                fps: formFps,
              }
            : {
                name: formName.trim(),
                location: formLocation.trim(),
                preset: formPreset,
                host: formHost.trim(),
                port: formPort || 554,
                username: formUsername,
                password: formPassword,
                path: formRtspPath.trim() || '/stream2',
                fps: formFps,
              };
        const res = await fetchWithAuth('/api/v1/cameras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          showToast(body?.detail || tr('เพิ่มกล้องไม่สำเร็จ', 'Failed to add camera'), 'error');
          return;
        }
        const created = mapManagedCamera(body.data.camera as BackendUserCamera);
        const probe = body.data.probe as ProbeResult | undefined;
        setStreams((prev) => [created, ...prev]);
        setStreamEnabled((prev) => ({ ...prev, [created.id]: true }));
        setActiveCameraId(created.id);
        setIsDialogOpen(false);
        if (probe?.warning) {
          showToast(probe.warning, 'warning');
        } else {
          showToast(tr('เพิ่มกล้อง RTSP สำเร็จ', 'RTSP camera added'), 'success');
        }
        return;
      }

      const safeStreamType: CameraStreamType =
        formStreamType === 'rtsp' ? 'hls' : formStreamType;
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
                streamType: safeStreamType,
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
          streamType: safeStreamType,
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
    const confirm = await showDeleteConfirm(
      tr('ต้องการลบกล้องนี้หรือไม่?', 'Delete this camera?'),
      tr('ลบกล้อง "{name}" ออกจากระบบ', 'Remove camera "{name}" from the workspace', {
        name: camName,
      }),
    );
    if (!confirm.isConfirmed) return;

    const target = streams.find((s) => s.id === camId);
    if (target?.managedId) {
      try {
        const res = await fetchWithAuth(`/api/v1/cameras/${target.managedId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          showToast(tr('ลบกล้องไม่สำเร็จ', 'Could not delete camera'), 'error');
          return;
        }
      } catch {
        showToast(tr('ลบกล้องไม่สำเร็จ', 'Could not delete camera'), 'error');
        return;
      }
    }

    const updated = streams.filter((s) => s.id !== camId);
    if (target?.managedId) {
      setStreams(updated);
    } else {
      await persistStreams(updated);
    }

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
      case 'hls':
        return tr('HLS Live (MediaMTX)', 'HLS live (MediaMTX)');
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
  const hlsPaused =
    activeCamera?.streamType === 'hls' && (!activeStreamEnabled || activeHlsState === 'paused');
  const hlsConnecting =
    activeCamera?.streamType === 'hls' &&
    activeStreamEnabled &&
    (!activeHlsState ||
      activeHlsState === 'idle' ||
      activeHlsState === 'waking' ||
      activeHlsState === 'connecting');
  const hlsError = activeCamera?.streamType === 'hls' && activeHlsState === 'error';

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
        {streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-grouped)] text-[var(--ink-muted)]">
              <Camera size={26} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-bold text-[var(--ink)]">
              {tr('ยังไม่มีกล้องในบัญชีนี้', 'No cameras yet')}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--ink-muted)]">
              {tr(
                'เพิ่มกล้องวงจรปิดของคุณเองด้วย RTSP หรือลิงก์ HLS (.m3u8) กล้องที่เพิ่มจะเห็นเฉพาะในบัญชีนี้เท่านั้น',
                'Add your own CCTV camera via RTSP or HLS (.m3u8). Cameras are private to your account.',
              )}
            </p>
            <button
              type="button"
              onClick={openAddDialog}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
            >
              <Plus size={15} aria-hidden="true" />
              {tr('เพิ่มกล้องตัวแรก', 'Add your first camera')}
            </button>
          </div>
        ) : (
        <div className="flex flex-col gap-5">
          {/* Primary View Screen */}
          <div className="mx-auto w-full max-w-5xl">
            <div
              ref={videoContainerRef}
              className="relative aspect-video overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-black"
            >
              {activeCamera?.status === 'online' || activeCamera?.streamType === 'hls' ? (
                <div className="relative h-full w-full">
                  {/* Stream Renderer according to streamType */}
                  {activeCamera.streamType === 'hls' && activeCamera.url ? (
                    activeStreamEnabled ? (
                      <HlsPlayer
                        key={activeCamera.id}
                        src={activeCamera.url}
                        enabled
                        refreshKey={activeRefreshKey}
                        label={activeCamera.name}
                        onStateChange={(state) => handleHlsState(activeCamera.id, state)}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
                        <CameraOff size={40} className="text-white/60" aria-hidden="true" />
                        <p className="text-[14px] font-semibold text-white">
                          {tr('สตรีมหยุดอยู่', 'Stream paused')}
                        </p>
                        <p className="text-[12px] text-white/60">
                          {tr(
                            'กดเล่นเพื่อประหยัดแบนด์วิดท์เมื่อไม่ได้ดู',
                            'Play only when you are watching to save bandwidth.',
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleStream(activeCamera.id)}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white active:scale-[0.95]"
                        >
                          <Play size={13} aria-hidden="true" />
                          {tr('เล่นสตรีม', 'Play stream')}
                        </button>
                      </div>
                    )
                  ) : activeCamera.streamType === 'snapshot' && activeCamera.url ? (
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
                        key={`${activeCamera.id}-${activeRefreshKey}`}
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
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--hairline-strong)] via-[var(--hairline-strong)] to-[var(--hairline-strong)]">
                      <div className="flex flex-col items-center gap-3 text-[var(--ink-muted)]">
                        <Camera
                          size={52}
                          className="animate-pulse text-[var(--info-ink)]"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-medium tracking-wide text-[var(--ink-faint)]">
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
                      {hlsPaused ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-md">
                          <Pause size={11} aria-hidden="true" />
                          {tr('หยุดชั่วคราว', 'Paused')}
                        </span>
                      ) : hlsConnecting ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-md">
                          <RefreshCw size={11} className="animate-spin" aria-hidden="true" />
                          {tr('กำลังเชื่อมต่อ', 'Connecting')}
                        </span>
                      ) : hlsError ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-md">
                          <CameraOff size={11} aria-hidden="true" />
                          {tr('ออฟไลน์', 'Offline')}
                        </span>
                      ) : null}
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
                        {activeCamera.streamType === 'hls' && (
                          <button
                            type="button"
                            onClick={() => toggleStream(activeCamera.id)}
                            className="rounded-full bg-[var(--glass-20)] p-2 text-white transition-colors hover:bg-[var(--glass-40)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.95]"
                            aria-label={
                              activeStreamEnabled
                                ? tr('หยุดสตรีมเพื่อประหยัดแบนด์วิดท์', 'Pause the stream to save bandwidth')
                                : tr('เล่นสตรีมอีกครั้ง', 'Resume the stream')
                            }
                          >
                            {activeStreamEnabled ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => refreshCamera(activeCamera.id)}
                          disabled={refreshing}
                          className="rounded-full bg-[var(--glass-20)] p-2 text-white transition-colors hover:bg-[var(--glass-40)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50 active:scale-[0.95]"
                          aria-label={tr('รีเฟรชสตรีมเฉพาะกล้องนี้', 'Refresh this camera stream')}
                        >
                          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={toggleFullscreen}
                          className="rounded-full bg-[var(--glass-20)] p-2 text-white transition-colors hover:bg-[var(--glass-40)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.95]"
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
                  <CameraOff size={48} className="text-[var(--ink-secondary)]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[var(--ink-faint)]">
                      {activeCamera?.name || tr('กล้อง', 'Camera')}{' '}
                      {tr('ตัดการเชื่อมต่อ (Offline)', 'is offline')}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
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
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-[var(--ink)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-apple-md bg-[var(--surface-grouped)]">
                    <Shield size={15} className="text-[var(--ink)]" aria-hidden="true" />
                  </div>
                  {tr('กล้องของคุณ ({count})', 'Your cameras ({count})', {
                    count: streams.length,
                  })}
                </h2>
                <button
                  type="button"
                  onClick={() => setSingleViewMode((v) => !v)}
                  className={[
                    'whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                    singleViewMode
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] ring-1 ring-[var(--accent-ring)]'
                      : 'bg-[var(--surface-grouped)] text-[var(--ink-muted)] hover:text-[var(--ink)]',
                  ].join(' ')}
                  title={tr('โหลดภาพเฉพาะกล้องที่กำลังดู เพื่อประหยัดสเปคและเน็ต', 'Load one stream at a time to save CPU & bandwidth')}
                >
                  {singleViewMode ? tr('โหมด: ดูทีละกล้อง', 'Mode: One at a time') : tr('โหมด: เปิดหลายกล้อง', 'Mode: Multi-stream')}
                </button>
              </div>

              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {streams.map((cam) => {
                  const isSelected = activeCamera?.id === cam.id;
                  const camHlsState =
                    isSelected && cam.streamType === 'hls' ? hlsStates[cam.id] : undefined;
                  const camPaused =
                    isSelected && cam.streamType === 'hls' && streamEnabled[cam.id] === false;
                  const camConnecting =
                    isSelected &&
                    cam.streamType === 'hls' &&
                    !camPaused &&
                    (!camHlsState ||
                      camHlsState === 'idle' ||
                      camHlsState === 'waking' ||
                      camHlsState === 'connecting');
                  const camLive =
                    cam.streamType === 'hls'
                      ? isSelected
                        ? camHlsState === 'playing'
                        : cam.status === 'online'
                      : cam.status === 'online';
                  const camStatusLabel = camPaused
                    ? tr('หยุดชั่วคราว', 'Paused')
                    : camConnecting
                      ? tr('กำลังเชื่อมต่อ', 'Connecting')
                      : camLive
                        ? cam.streamType === 'hls'
                          ? 'LIVE'
                          : tr('ออนไลน์', 'Online')
                        : tr('ออฟไลน์', 'Offline');
                  const camStatusTone = camPaused
                    ? 'bg-[var(--surface-chip)] text-[var(--ink-muted)]'
                    : camConnecting
                      ? 'bg-[var(--warning-soft)] text-[var(--warning-ink)]'
                      : camLive
                        ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
                        : 'bg-[var(--danger-soft)] text-[var(--danger-ink)]';
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
                          onClick={() => selectCamera(cam.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-apple-widget text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          aria-label={`${cam.name} — ${camStatusLabel}`}
                        >
                          {/* Icon badge */}
                          <div
                            className={[
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md',
                              camStatusTone,
                            ].join(' ')}
                          >
                            {camLive || camConnecting ? (
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
                            className="rounded-apple-md p-2 text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] [@media(hover:none)]:opacity-100"
                            aria-label={tr('แก้ไข {name}', 'Edit {name}', { name: cam.name })}
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCamera(cam.id, cam.name);
                            }}
                            className="rounded-apple-md p-2 text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[var(--danger-soft)] hover:text-[var(--danger-ink)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--danger)] [@media(hover:none)]:opacity-100"
                            aria-label={tr('ลบ {name}', 'Delete {name}', { name: cam.name })}
                          >
                            <Trash2 size={13} />
                          </button>

                          <span
                            className={[
                              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              camStatusTone,
                            ].join(' ')}
                          >
                            {camLive && cam.streamType === 'hls' && (
                              <span
                                className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle"
                                aria-hidden="true"
                              />
                            )}
                            {camStatusLabel}
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
        )}

        {/* ── Add / Edit Camera Dialog ─────────────────────────────────── */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle>
                {editingCameraId
                  ? tr('แก้ไขข้อมูลกล้องวงจรปิด', 'Edit camera')
                  : tr('เพิ่มกล้องวงจรปิดใหม่', 'Add a camera')}
              </DialogTitle>
              <DialogDescription>
                {tr(
                  'ข้อมูลกล้องจะถูกเข้ารหัสและเก็บเฉพาะในบัญชีของคุณ',
                  'Camera details are encrypted and private to your account.',
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCamera} autoComplete="off">
              <DialogBody className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="camera-name"
                      className="block text-xs font-semibold text-[var(--ink)]"
                    >
                      {tr('ชื่อกล้อง', 'Camera name')} <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      id="camera-name"
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={tr('เช่น หน้าร้าน', 'e.g. Front entrance')}
                      className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] px-3 py-2 text-sm text-[var(--ink)] transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="camera-location"
                      className="block text-xs font-semibold text-[var(--ink)]"
                    >
                      {tr('ตำแหน่ง (ไม่บังคับ)', 'Location (optional)')}
                    </label>
                    <input
                      id="camera-location"
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder={tr('เช่น ประตูหน้า', 'e.g. Main door')}
                      className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] px-3 py-2 text-sm text-[var(--ink)] transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                  </div>
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
                    onChange={(next) => {
                      setFormStreamType(next);
                      setProbeState(null);
                    }}
                    options={[
                      ...(!editingCameraId ? [{ value: 'rtsp' as const, label: tr('กล้อง RTSP', 'RTSP') }] : []),
                      { value: 'hls' as const, label: 'HLS (.m3u8)' },
                      { value: 'snapshot' as const, label: tr('ภาพนิ่ง', 'Snapshot') },
                      { value: 'mjpeg' as const, label: 'MJPEG' },
                    ]}
                  />
                </div>

                {formStreamType === 'rtsp' && !editingCameraId && (
                  <div className="space-y-3 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] p-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)]">
                        {tr('ยี่ห้อ / รูปแบบกล้อง', 'Camera brand / preset')}
                      </label>
                      <Select
                        ariaLabel={tr('ยี่ห้อ / รูปแบบกล้อง', 'Camera brand / preset')}
                        value={formPreset}
                        onChange={(next) => {
                          const preset = next as RtspPreset;
                          setFormPreset(preset);
                          setFormRtspPath(RTSP_PRESET_PATHS[preset]);
                          setProbeState(null);
                        }}
                        size="md"
                        options={[
                          { value: 'tapo', label: 'TP-Link Tapo (/stream2)' },
                          { value: 'hikvision', label: 'Hikvision (/Streaming/Channels/102)' },
                          { value: 'dahua', label: 'Dahua (subtype=1)' },
                          { value: 'reolink', label: 'Reolink (h264Preview_01_sub)' },
                          { value: 'custom', label: tr('กำหนดเอง (Custom RTSP)', 'Custom RTSP') },
                        ]}
                        className="mt-1 w-full"
                      />
                    </div>

                    {formPreset === 'custom' && formUrl.trim().startsWith('rtsp') ? (
                      <div>
                        <label
                          htmlFor="camera-rtsp-raw"
                          className="block text-xs font-semibold text-[var(--ink)]"
                        >
                          RTSP URL
                        </label>
                        <input
                          id="camera-rtsp-raw"
                          type="text"
                          value={formUrl}
                          onChange={(e) => setFormUrl(e.target.value)}
                          placeholder="rtsp://user:pass@ddns-host:49110/stream2"
                          className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label
                              htmlFor="camera-host"
                              className="block text-xs font-semibold text-[var(--ink)]"
                            >
                              Host / DDNS <span className="text-[var(--danger)]">*</span>
                            </label>
                            <input
                              id="camera-host"
                              type="text"
                              required
                              value={formHost}
                              onChange={(e) => setFormHost(e.target.value)}
                              placeholder="tthanyapong.trueddns.com"
                              className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="camera-port"
                              className="block text-xs font-semibold text-[var(--ink)]"
                            >
                              {tr('Port (พอร์ตภายนอก)', 'External Port')}
                            </label>
                            <input
                              id="camera-port"
                              type="number"
                              min={1}
                              max={65535}
                              value={formPort}
                              onChange={(e) => setFormPort(Number(e.target.value))}
                              placeholder="49110"
                              className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
                          {tr(
                            'ใช้พอร์ตภายนอกที่เปิด Port Forward / TrueDDNS ไว้ (เช่น 49110, 49111) ไม่ใช่ 554 ภายในวง LAN',
                            'Use the forwarded external port (e.g. 49110, 49111), not the internal LAN port 554.',
                          )}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="camera-rtsp-user"
                              className="block text-xs font-semibold text-[var(--ink)]"
                            >
                              Username
                            </label>
                            <input
                              id="camera-rtsp-user"
                              name="camera-rtsp-user"
                              type="text"
                              autoComplete="off"
                              value={formUsername}
                              onChange={(e) => setFormUsername(e.target.value)}
                              placeholder="ART@IOT31"
                              className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="camera-rtsp-pass"
                              className="block text-xs font-semibold text-[var(--ink)]"
                            >
                              Password
                            </label>
                            <input
                              id="camera-rtsp-pass"
                              name="camera-rtsp-pass"
                              type="password"
                              autoComplete="new-password"
                              value={formPassword}
                              onChange={(e) => setFormPassword(e.target.value)}
                              placeholder="••••••••"
                              className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)]"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="camera-rtsp-path"
                            className="block text-xs font-semibold text-[var(--ink)]"
                          >
                            Stream Path
                          </label>
                          <input
                            id="camera-rtsp-path"
                            type="text"
                            value={formRtspPath}
                            onChange={(e) => setFormRtspPath(e.target.value)}
                            placeholder="/stream2"
                            className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
                          />
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                            {tr(
                              'ระบบจะเข้ารหัส @ และอักขระพิเศษให้อัตโนมัติ (แนะนำ H.264: /stream2 หรือ /stream1 ถ้ากล้องตั้งเป็น H.264 จะคมชัดกว่าโดยไม่กินสเปค)',
                              'Special characters are auto-encoded. H.264 (/stream2 or H.264 /stream1) is recommended.',
                            )}
                          </p>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleProbeRtsp}
                        disabled={isProbing}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)] transition-colors hover:bg-[var(--surface-chip)] disabled:opacity-50"
                      >
                        {isProbing ? (
                          <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Wifi size={12} aria-hidden="true" />
                        )}
                        {tr('ทดสอบการเชื่อมต่อ', 'Test connection')}
                      </button>
                      {probeState?.codec && (
                        <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)]">
                          {probeState.codec}
                          {probeState.resolution ? ` · ${probeState.resolution}` : ''}
                        </span>
                      )}
                    </div>

                    {probeState && (
                      <div
                        className={[
                          'rounded-apple-md px-3 py-2 text-[11px] leading-relaxed',
                          probeState.error
                            ? 'bg-[var(--danger-soft)] text-[var(--danger-ink)]'
                            : probeState.warning
                              ? 'bg-[var(--warning-soft)] text-[var(--warning-ink)]'
                              : 'bg-[var(--success-soft)] text-[var(--success-ink)]',
                        ].join(' ')}
                      >
                        {probeState.error ? (
                          probeState.error
                        ) : probeState.warning ? (
                          <span className="flex items-start gap-1.5">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span>{probeState.warning}</span>
                          </span>
                        ) : (
                          tr('เชื่อมต่อกล้องสำเร็จ พร้อมใช้งาน!', 'Camera reachable and ready!')
                        )}
                      </div>
                    )}
                  </div>
                )}

                {formStreamType !== 'simulated' && formStreamType !== 'rtsp' && (
                  <div>
                    <label
                      htmlFor="camera-url"
                      className="block text-xs font-semibold text-[var(--ink)]"
                    >
                      {tr('URL สตรีม / Snapshot URL', 'Stream URL / snapshot URL')}{' '}
                      <span className="text-[var(--danger)]">*</span>
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
                            : 'https://mediamtx.onrender.com/front-door/index.m3u8'
                      }
                      className="mt-1 block w-full rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-grouped)] px-3 py-2 font-mono text-xs text-[var(--ink)] transition-colors focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)]"
                    />
                    {formStreamType === 'hls' && (
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                        {tr(
                          'ใช้ URL Manifest .m3u8 ของ MediaMTX และเปิด CORS ให้โดเมนนี้',
                          'Use the MediaMTX .m3u8 manifest URL and allow this origin in CORS.',
                        )}
                      </p>
                    )}
                  </div>
                )}

                {formStreamType === 'snapshot' && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink)]">
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
              </DialogBody>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-chip)]"
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
