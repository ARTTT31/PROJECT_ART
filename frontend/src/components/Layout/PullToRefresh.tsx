'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Loader2 } from 'lucide-react';
import { hapticTap, hapticSuccess } from '@/utils/haptics';

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 60;
const MAX_PULL = 80;
/** Height the indicator occupies once it is fully revealed. */
const INDICATOR_HEIGHT = 44;
/** How long "อัปเดตแล้ว" stays up after a refresh finishes. */
const DONE_HOLD_MS = 900;

/**
 * Pull-to-refresh for the dashboard.
 *
 * The indicator is part of the layout, not a fixed overlay: growing its row is
 * what pushes the page down while pulling. The previous `position: fixed`
 * pill sat on top of the greeting card (a floating circle over the hero), so
 * it both hid content and looked detached from the gesture. Growing the row
 * also means the indicator can never cover a control the user is aiming at.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [didRefresh, setDidRefresh] = useState(false);

  const startYRef = useRef<number | null>(null);
  const pullYRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull-down when scrolled to the very top
      if (window.scrollY <= 0 && !isRefreshingRef.current) {
        startYRef.current = e.touches[0].clientY;
        hasTriggeredHapticRef.current = false;
      } else {
        startYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshingRef.current) return;

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
      if (startYRef.current === null || isRefreshingRef.current) return;

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
          setDidRefresh(true);
          window.setTimeout(() => setDidRefresh(false), DONE_HOLD_MS);
        } catch {
          // A failed refresh is reported by the page itself; the gesture just ends.
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
    // `pullY` is deliberately absent: rebinding the listeners on every pixel of
    // movement dropped touch events and made the gesture stutter. Refs carry
    // the live values instead.
  }, [onRefresh]);

  const armed = pullY >= PULL_THRESHOLD;
  const reveal = isRefreshing || didRefresh
    ? INDICATOR_HEIGHT
    : Math.min(INDICATOR_HEIGHT, pullY * 0.62);
  const progress = Math.min(1, pullY / PULL_THRESHOLD);
  const showIndicator = reveal > 0;

  return (
    <div className="relative w-full">
      {/* Reserved row: it grows with the gesture, so nothing is covered. */}
      <div
        className="overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: reveal }}
        aria-hidden={!showIndicator}
      >
        {showIndicator && (
          <div
            data-testid="pull-to-refresh-indicator"
            aria-live="polite"
            className="flex h-11 items-center justify-center"
          >
            <div className="flex items-center gap-2.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--ink-secondary)]">
              <span className="relative flex h-5 w-5 items-center justify-center">
                {didRefresh ? (
                  <Check size={14} className="text-[var(--success)]" aria-hidden="true" />
                ) : isRefreshing ? (
                  <Loader2
                    className="h-4 w-4 animate-spin text-[var(--accent)]"
                    aria-hidden="true"
                  />
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90" aria-hidden="true">
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        fill="none"
                        stroke="var(--hairline-strong)"
                        strokeWidth="2"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={`${progress * 50.27} 50.27`}
                      />
                    </svg>
                    <ArrowDown
                      size={11}
                      aria-hidden="true"
                      className={`absolute text-[var(--accent)] transition-transform duration-200 ${
                        armed ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                )}
              </span>
              <span>
                {didRefresh
                  ? 'อัปเดตแล้ว'
                  : isRefreshing
                    ? 'กำลังอัปเดต…'
                    : armed
                      ? 'ปล่อยเพื่อรีเฟรช'
                      : 'ดึงลงเพื่อรีเฟรช'}
              </span>
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export default PullToRefresh;
