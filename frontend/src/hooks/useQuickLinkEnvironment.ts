'use client';

import { useCallback, useState } from 'react';
import type { QuickLinkEnvironmentKey } from '@/utils/quickLinks';

/**
 * Which environment each quick link currently points at.
 *
 * This is a per-browser preference, not workspace data: two people sharing an
 * account should not fight over whether "ระบบ HR" opens staging. A link with no
 * stored choice opens its production URL.
 */
export const QUICK_LINK_ENV_STORAGE_KEY = 'artQuickLinkEnvV1';

type EnvironmentMap = Record<string, QuickLinkEnvironmentKey>;

function readMap(): EnvironmentMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(QUICK_LINK_ENV_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as EnvironmentMap)
      : {};
  } catch {
    return {};
  }
}

export function useQuickLinkEnvironment() {
  const [map, setMap] = useState<EnvironmentMap>(() => readMap());

  const get = useCallback(
    (linkId: string): QuickLinkEnvironmentKey => map[linkId] ?? 'production',
    [map],
  );

  const select = useCallback((linkId: string, environment: QuickLinkEnvironmentKey) => {
    setMap((prev) => {
      const next = { ...prev, [linkId]: environment };
      try {
        localStorage.setItem(QUICK_LINK_ENV_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: the choice simply does not persist */
      }
      return next;
    });
  }, []);

  return { get, select };
}

export default useQuickLinkEnvironment;
