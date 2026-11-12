'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { OFFLINE_CHANGE_EVENT, pendingCount } from '@/lib/offline/localStore';
import { useI18n } from '@/lib/i18n/I18nProvider';

/**
 * Global connection banner.
 *
 * The widget-level messages only tell the story inside one card; this tells it
 * for the whole app: whether we are offline, how many resources still have
 * edits queued, and that those queued edits went through when the connection
 * came back.
 */
export default function OfflineBanner() {
  const { tr } = useI18n();
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

  // A tinted card rather than a full-width bar: the bar sat above the app shell
  // and pushed the whole page down every time the connection flapped, and it was
  // rendered twice (providers + dashboard layout) so it stacked.
  const tone = isOffline
    ? 'border-[var(--hairline)] bg-[var(--warning-soft)] text-[var(--warning)]'
    : queued > 0
      ? 'border-[var(--hairline)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
      : 'border-[var(--hairline)] bg-[var(--success-soft)] text-[var(--success-ink)]';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-apple-lg border px-4 py-3 text-[12px] font-semibold shadow-xs backdrop-blur-md transition-all duration-300 md:text-[13px] ${tone}`}
      >
        {isOffline ? (
          <>
            <WifiOff size={16} className="mt-0.5 shrink-0 animate-pulse" aria-hidden="true" />
            <span className="leading-relaxed">
              {tr('ออฟไลน์ · ข้อมูลล่าสุดถูกเก็บไว้ในเครื่อง', 'Offline · your latest data is stored on this device')}
              {queued > 0
                ? tr(' และมี {count} รายการรอซิงก์', ' · {count} items waiting to sync', { count: queued })
                : tr(' แก้ไขต่อได้เลย', ' · you can keep editing')}
            </span>
          </>
        ) : queued > 0 ? (
          <>
            <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
            <div className="flex flex-1 items-center justify-between gap-2.5">
              <span className="leading-relaxed">
                {tr('กลับมาออนไลน์แล้ว · กำลังซิงก์ {count} รายการที่ค้างไว้', 'Back online · syncing {count} queued items', { count: queued })}
              </span>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event('online'));
                  refreshQueue();
                }}
                className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-text)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-grouped)] active:scale-95"
              >
                {tr('ซิงก์ทันที', 'Sync now')}
              </button>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="leading-relaxed">{tr('ซิงก์ข้อมูลที่ค้างไว้ครบแล้ว', 'All queued changes are synced')}</span>
          </>
        )}
      </div>
    </div>
  );
}
