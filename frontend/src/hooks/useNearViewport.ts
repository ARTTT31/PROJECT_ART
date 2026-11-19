'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_ROOT_MARGIN = '400px';

/**
 * Flips to `true` the first time the referenced element comes within
 * `rootMargin` of the viewport, then never flips back. The dashboard keeps the
 * sortable wrapper mounted and only defers its children, so dnd-kit's ref,
 * grid span and keyboard sorting are untouched (finding U13).
 *
 * Falls back to mounting immediately when IntersectionObserver is unavailable
 * (jsdom, older browsers) or the ref never attaches.
 */
export function useNearViewport<T extends HTMLElement>(rootMargin = DEFAULT_ROOT_MARGIN) {
  const ref = useRef<T | null>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isNear };
}
