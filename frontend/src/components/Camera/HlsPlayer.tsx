'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type Hls from 'hls.js';
import { useI18n } from '@/lib/i18n/I18nProvider';

export type HlsPlayerState = 'idle' | 'waking' | 'connecting' | 'playing' | 'error' | 'paused';

interface HlsPlayerProps {
  /** MediaMTX HLS manifest, e.g. https://host/camera/index.m3u8 */
  src: string;
  enabled: boolean;
  /** Bump to force a fresh manifest request for this camera. */
  refreshKey: number;
  label: string;
  poster?: string;
  onStateChange?: (state: HlsPlayerState) => void;
  onStatusChange?: (status: 'online' | 'offline') => void;
}

const RETRY_DELAYS_MS = [3_000, 6_000, 12_000] as const;

/**
 * Low-latency HLS viewer with a cold-start retry loop.
 *
 * Render free instances sleep, so the first manifest request can fail while the
 * service wakes. Each retry deliberately asks MediaMTX for the manifest again:
 * that request is what wakes the deployed service. hls.js handles normal
 * segment retries; this loop only covers fatal network failures.
 */
export default function HlsPlayer({
  src,
  enabled,
  refreshKey,
  label,
  poster,
  onStateChange,
  onStatusChange,
}: HlsPlayerProps) {
  const { tr } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onStateChange, onStatusChange });
  const [state, setState] = useState<HlsPlayerState>('idle');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    callbacks.current = { onStateChange, onStatusChange };
  }, [onStateChange, onStatusChange]);

  const emit = useCallback((next: HlsPlayerState) => {
    setState(next);
    callbacks.current.onStateChange?.(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      emit('paused');
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    const media: HTMLVideoElement = video;

    let disposed = false;
    let hls: Hls | null = null;
    let attempt = 0;
    let failing = false;
    let retryTimer: number | undefined;

    const destroyPlayer = () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      media.removeAttribute('src');
      media.load();
    };

    function fail() {
      // A failed `media.load()` can emit another error while the retry timer is
      // being scheduled; one attempt must own the retry.
      if (disposed || failing) return;
      failing = true;
      destroyPlayer();
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        attempt += 1;
        emit('waking');
        retryTimer = window.setTimeout(() => {
          failing = false;
          void start();
        }, delay);
        return;
      }
      emit('error');
      callbacks.current.onStatusChange?.('offline');
    }

    async function start() {
      if (disposed) return;
      emit('waking');

      // Safari/iOS play HLS natively; hls.js is only loaded when needed.
      if (media.canPlayType('application/vnd.apple.mpegurl') !== '') {
        media.src = src;
        media.load();
        const playback = media.play();
        if (playback) void playback.catch(() => {});
        return;
      }

      try {
        const { default: HlsCtor } = await import('hls.js');
        if (disposed) return;
        if (!HlsCtor.isSupported()) {
          emit('error');
          callbacks.current.onStatusChange?.('offline');
          return;
        }

        hls = new HlsCtor({
          lowLatencyMode: true,
          enableWorker: true,
          backBufferLength: 30,
          maxBufferLength: 10,
          manifestLoadingTimeOut: 30_000,
          manifestLoadingMaxRetry: 2,
          manifestLoadingRetryDelay: 2_000,
          levelLoadingTimeOut: 20_000,
          fragLoadingTimeOut: 20_000,
        });

        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          if (disposed) return;
          emit('connecting');
          const playback = media.play();
          if (playback) void playback.catch(() => {});
        });

        hls.on(HlsCtor.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return;
          if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
            fail();
            return;
          }
          if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          emit('error');
          callbacks.current.onStatusChange?.('offline');
        });

        hls.loadSource(src);
        hls.attachMedia(media);
      } catch {
        fail();
      }
    }

    const onLoadedMetadata = () => {
      if (!disposed) emit('connecting');
    };
    const onPlaying = () => {
      if (disposed) return;
      emit('playing');
      callbacks.current.onStatusChange?.('online');
    };
    const onVideoError = () => fail();

    media.addEventListener('loadedmetadata', onLoadedMetadata);
    media.addEventListener('playing', onPlaying);
    media.addEventListener('error', onVideoError);

    void start();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      media.removeEventListener('loadedmetadata', onLoadedMetadata);
      media.removeEventListener('playing', onPlaying);
      media.removeEventListener('error', onVideoError);
      destroyPlayer();
    };
  }, [src, enabled, refreshKey, retryKey, emit]);

  const waking = state === 'idle' || state === 'waking';
  const connecting = state === 'connecting';

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        muted
        playsInline
        autoPlay
        preload="none"
        poster={poster}
        aria-label={label}
      />

      {(waking || connecting) && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-sm"
        >
          <Loader2 size={30} className="animate-spin text-white/80" aria-hidden="true" />
          <div>
            <p className="text-[14px] font-semibold text-white">
              {waking
                ? tr('กำลังปลุกเซิร์ฟเวอร์กล้อง...', 'Waking the camera server…')
                : tr('กำลังเชื่อมต่อสัญญาณภาพ...', 'Connecting to the video feed…')}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/60">
              {waking
                ? tr(
                    'Render กำลังตื่นจากโหมดประหยัดพลังงาน อาจใช้เวลาถึง 1 นาที',
                    'Render is waking from sleep; this can take up to a minute.',
                  )
                : tr('กำลังรอ MediaMTX ส่งภาพแรก', 'Waiting for MediaMTX to send the first frame.')}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-1.5 opacity-40" aria-hidden="true">
            {[16, 24, 12].map((width, index) => (
              <span
                key={width}
                className="skeleton-shimmer h-1.5 rounded-full"
                style={{ width, animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 px-6 text-center backdrop-blur-sm"
        >
          <WifiOff size={30} className="text-white/70" aria-hidden="true" />
          <p className="text-[14px] font-semibold text-white">
            {tr('ไม่สามารถเชื่อมต่อกล้องได้', 'Could not connect to the camera')}
          </p>
          <p className="max-w-[360px] text-[12px] leading-relaxed text-white/60">
            {tr(
              'ตรวจสอบ URL สตรีม การตั้งค่า CORS ของ MediaMTX หรือสถานะเซิร์ฟเวอร์บน Render',
              'Check the stream URL, MediaMTX CORS settings, or the Render service status.',
            )}
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white active:scale-[0.95]"
          >
            <RefreshCw size={13} aria-hidden="true" />
            {tr('ลองใหม่', 'Try again')}
          </button>
        </div>
      )}
    </div>
  );
}
