'use client';

/**
 * Persisted notification history.
 *
 * The bell's in-memory store is capped and dies with the tab, so anything that
 * arrived while the dashboard was closed was gone for good. This keeps the last
 * few hundred entries per account on the device, which is what the history page
 * reads. It is a local archive, not a server record: notifications are derived
 * on the client from holiday/weather/oil data plus admin broadcasts, so there
 * is nothing durable on the backend to page through.
 */

import { offlineScope } from '@/lib/offline/localStore';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

export interface StoredNotification {
  id: string;
  type: 'holiday' | 'weather' | 'oilprice' | 'system';
  level: 'info' | 'warning' | 'danger';
  title: string;
  body: string;
  at: string;
}

const PREFIX = 'artNotificationHistoryV1';
const MAX_ENTRIES = 200;

function key(): string {
  return `${PREFIX}:${offlineScope()}`;
}

export function readHistory(): StoredNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredNotification =>
        item &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.body === 'string' &&
        typeof item.at === 'string',
    );
  } catch {
    return [];
  }
}

function writeHistory(entries: StoredNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(), JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota / private mode: the in-memory bell still works.
  }
}

/** Merge live notifications into the archive; newest first, no duplicates. */
export function appendHistory(
  items: Array<{
    id: string;
    type: 'holiday' | 'weather' | 'oilprice' | 'system';
    level: 'info' | 'warning' | 'danger';
    title: string;
    body: string;
    at: Date;
  }>,
): StoredNotification[] {
  const byId = new Map(readHistory().map((entry) => [entry.id, entry]));
  items.forEach((item) => {
    byId.set(item.id, {
      id: item.id,
      type: item.type,
      level: item.level,
      title: item.title,
      body: item.body,
      at: item.at.toISOString(),
    });
  });
  const next = Array.from(byId.values()).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  writeHistory(next);
  return next.slice(0, MAX_ENTRIES);
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key());
  } catch {
    // Nothing stored.
  }
}

// ── Server copy ─────────────────────────────────────────────────────────────
// The archive above is what makes the bell work offline; the server copy is
// what makes it follow the account to another device.

export interface ServerNotification {
  id: number;
  client_id: string;
  type: StoredNotification['type'];
  level: StoredNotification['level'];
  title: string;
  body: string;
  at: string;
  read: boolean;
}

/** Push the local archive so a fresh device can read it back. Best-effort. */
export async function syncHistoryToServer(
  items: Array<{
    id: string;
    type: StoredNotification['type'];
    level: StoredNotification['level'];
    title: string;
    body: string;
    at: Date | string;
  }>,
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (items.length === 0) return;
  try {
    await fetchWithAuth('/api/v1/notifications/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.slice(0, 50).map((item) => ({
          client_id: item.id,
          type: item.type,
          level: item.level,
          title: item.title,
          body: item.body,
          at: typeof item.at === 'string' ? item.at : item.at.toISOString(),
        })),
      }),
    });
  } catch {
    // Offline or a sleeping backend: the local archive still has it.
  }
}

/** ``null`` means the server could not be reached (use the local archive). */
export async function fetchServerHistory(): Promise<ServerNotification[] | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  try {
    const res = await fetchWithAuth('/api/v1/notifications?limit=200');
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: ServerNotification[] };
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return null;
  }
}

export async function markAllReadOnServer(): Promise<void> {
  try {
    await fetchWithAuth('/api/v1/notifications/read-all', { method: 'POST' });
  } catch {
    // Local read state is still recorded.
  }
}

export async function clearHistoryOnServer(): Promise<void> {
  try {
    await fetchWithAuth('/api/v1/notifications', { method: 'DELETE' });
  } catch {
    // The local archive is cleared either way.
  }
}
