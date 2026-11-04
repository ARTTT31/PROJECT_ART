'use client';

import { useEffect, useState } from 'react';
import { isOffline } from './localStore';

/** Reactive `navigator.onLine`, for widgets that show a sync/offline hint. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => !isOffline());

  useEffect(() => {
    const sync = () => setOnline(!isOffline());
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}
