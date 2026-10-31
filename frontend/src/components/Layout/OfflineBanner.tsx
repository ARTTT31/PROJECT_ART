'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (timer) clearTimeout(timer);
      setIsOffline(true);
      setJustReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-2 px-4 text-xs md:text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 z-50 ${
        isOffline ? 'bg-amber-500 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff size={15} className="shrink-0 animate-pulse" />
          <span>คุณกำลังทำงานในโหมดออฟไลน์ ข้อมูลที่แสดงผลเป็นข้อมูลล่าสุดที่บันทึกไว้</span>
        </>
      ) : (
        <>
          <Wifi size={15} className="shrink-0" />
          <span>เชื่อมต่ออินเทอร์เน็ตสำเร็จแล้ว ระบบกำลังซิงค์ข้อมูลล่าสุด</span>
        </>
      )}
    </div>
  );
}
