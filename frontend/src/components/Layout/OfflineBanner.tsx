'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';
import { OFFLINE_CHANGE_EVENT, pendingCount } from '@/lib/offline/localStore';

/**
 * Global connection banner.
 *
 * The widget-level messages only tell the story inside one card; this tells it
 * for the whole app: whether we are offline, how many resources still have
 * edits queued, and that those queued edits went through when the connection
 * came back.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  const refreshQueue = useCallback(() => {
    setQueued(pendingCount());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(navigator.onLine === false);
    refreshQueue();

    let clearedTimer: ReturnType<typeof setTimeout> | null = null;
    let syncedTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      setIsOffline(true);
      setJustSynced(false);
      refreshQueue();
    };

    const handleOnline = () => {
      setIsOffline(false);
      refreshQueue();
      // The widgets replay their queues on the `online` event; give them a
      // moment before saying anything about the result.
      if (clearedTimer) clearTimeout(clearedTimer);
      clearedTimer = setTimeout(refreshQueue, 2_000);
    };

    const handleChange = () => refreshQueue();

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_CHANGE_EVENT, handleChange);

    return () => {
      if (clearedTimer) clearTimeout(clearedTimer);
      if (syncedTimer) clearTimeout(syncedTimer);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_CHANGE_EVENT, handleChange);
    };
  }, [refreshQueue]);

  // Announce a completed sync once the queue empties while online, then get out
  // of the way: a permanent "synced" bar becomes noise.
  useEffect(() => {
    if (isOffline || queued > 0) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const hadQueue = sessionStorage.getItem('artOfflineHadQueue') === '1';
    if (hadQueue) {
      sessionStorage.removeItem('artOfflineHadQueue');
      setJustSynced(true);
      hideTimer = setTimeout(() => setJustSynced(false), 3_500);
    }
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isOffline, queued]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (queued > 0) sessionStorage.setItem('artOfflineHadQueue', '1');
  }, [queued]);

  if (!isOffline && queued === 0 && !justSynced) return null;

  const tone = isOffline
    ? 'bg-amber-500 text-white'
    : queued > 0
      ? 'bg-[var(--accent)] text-white'
      : 'bg-emerald-600 text-white';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`z-50 flex w-full items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all duration-300 md:text-sm ${tone}`}
    >
      {isOffline ? (
        <>
          <WifiOff size={15} className="shrink-0 animate-pulse" aria-hidden="true" />
          <span>
            ออฟไลน์ · ข้อมูลล่าสุดถูกเก็บไว้ในเครื่อง
            {queued > 0 ? ` และมี ${queued} รายการรอซิงก์` : ' แก้ไขต่อได้เลย'}
          </span>
        </>
      ) : queued > 0 ? (
        <>
          <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" />
          <span>กลับมาออนไลน์แล้ว · กำลังซิงก์ {queued} รายการที่ค้างไว้</span>
        </>
      ) : (
        <>
          <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />
          <span>ซิงก์ข้อมูลที่ค้างไว้ครบแล้ว</span>
        </>
      )}
    </div>
  );
}
