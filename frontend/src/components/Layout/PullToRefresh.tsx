'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hapticTap, hapticSuccess } from '@/utils/haptics';

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 60;
const MAX_PULL = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullYRef = useRef(0);
  const hasTriggeredHapticRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull-down when scrolled to the very top
      if (window.scrollY <= 0 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        hasTriggeredHapticRef.current = false;
      } else {
        startYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0 && window.scrollY <= 0) {
        // Logarithmic resistance curve for Apple-like rubber-banding
        const distance = Math.min(MAX_PULL, Math.pow(diff, 0.82));
        pullYRef.current = distance;
        setPullY(distance);

        if (distance >= PULL_THRESHOLD && !hasTriggeredHapticRef.current) {
          hasTriggeredHapticRef.current = true;
          hapticTap();
        } else if (distance < PULL_THRESHOLD && hasTriggeredHapticRef.current) {
          hasTriggeredHapticRef.current = false;
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    const handleTouchEnd = async () => {
      if (startYRef.current === null || isRefreshing) return;

      const shouldRefresh = pullYRef.current >= PULL_THRESHOLD;
      startYRef.current = null;
      pullYRef.current = 0;

      if (shouldRefresh) {
        setIsRefreshing(true);
        setPullY(PULL_THRESHOLD * 0.8);
        hapticSuccess();

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Default: dispatch global workspace refresh event or reload
            window.dispatchEvent(new CustomEvent('workspace:refresh'));
            await new Promise((resolve) => setTimeout(resolve, 800));
            window.location.reload();
          }
        } catch {
          // Graceful catch
        } finally {
          setIsRefreshing(false);
          setPullY(0);
        }
      } else {
        setPullY(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, onRefresh, pullY]);

  const rotation = Math.min(360, pullY * 6);
  const opacity = Math.min(1, pullY / 30);

  return (
    <div className="relative w-full">
      {/* Pull Indicator Pill */}
      {(pullY > 0 || isRefreshing) && (
        <div
          data-testid="pull-to-refresh-indicator"
          aria-live="polite"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-40 transition-all duration-apple-2 ease-apple"
          style={{
            transform: `translate(-50%, ${pullY > 0 ? pullY * 0.7 : 0}px)`,
            opacity: isRefreshing ? 1 : opacity,
          }}
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--hairline)] shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-md text-xs font-medium">
            <Loader2
              className={`w-3.5 h-3.5 text-[var(--accent)] ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: !isRefreshing ? `rotate(${rotation}deg)` : undefined,
              }}
            />
            <span>{isRefreshing ? 'กำลังอัปเดต...' : pullY >= PULL_THRESHOLD ? 'ปล่อยเพื่อรีเฟรช' : 'ดึงลงเพื่อรีเฟรช'}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        style={{
          transform: pullY > 0 ? `translateY(${pullY * 0.4}px)` : undefined,
          transition: isRefreshing ? 'transform 0.3s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
