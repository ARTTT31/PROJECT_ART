'use client';

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

/**
 * One JSON request shared by every dashboard widget that needs the same data.
 *
 * The daily digest, the market card and the oil card each fetched the same
 * `/market/summary` and `/oil-prices` payloads on every mount, so opening the
 * dashboard cost two identical backend (and upstream) calls per widget. This
 * cache serves a short-lived copy and joins a request that is already in
 * flight, so one widget's fetch answers the others.
 *
 * Only successful responses are cached: a 502 has to reach each caller with its
 * status so the widget can keep showing its specific error copy.
 */

export interface SharedResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

interface CacheEntry {
  at: number;
  value: unknown;
}

const FRESH = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<SharedResponse<unknown>>>();

export async function fetchShared<T>(url: string, ttlMs: number): Promise<SharedResponse<T>> {
  const hit = FRESH.get(url);
  if (hit && Date.now() - hit.at <= ttlMs) {
    return { ok: true, status: 200, data: hit.value as T };
  }

  const running = INFLIGHT.get(url);
  if (running) return (await running) as SharedResponse<T>;

  const request = (async (): Promise<SharedResponse<T>> => {
    try {
      const res = await fetchWithAuth(url);
      if (!res.ok) return { ok: false, status: res.status, data: null };
      const data = (await res.json().catch(() => null)) as T | null;
      if (data == null) return { ok: false, status: res.status, data: null };
      FRESH.set(url, { at: Date.now(), value: data });
      return { ok: true, status: res.status, data };
    } catch {
      // Network failure / timeout: no status, no cache entry.
      return { ok: false, status: 0, data: null };
    } finally {
      INFLIGHT.delete(url);
    }
  })();

  INFLIGHT.set(url, request as Promise<SharedResponse<unknown>>);
  return request;
}

/** Drop every cached payload (tests, and after an explicit user refresh). */
export function clearSharedFetchCache(): void {
  FRESH.clear();
  INFLIGHT.clear();
}
