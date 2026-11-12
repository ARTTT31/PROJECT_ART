/**
 * Offline mirror + write queue for per-account data.
 *
 * The service worker never caches `/api/` responses: they are session-private,
 * so a stale cached response must not outlive the account that fetched it
 * (src/app/sw.ts). Offline reads therefore come from here instead — each widget
 * mirrors the last list the server returned into localStorage, scoped to the
 * signed-in account, and keeps edits that could not be sent as a pending
 * snapshot that is replayed when the connection comes back.
 *
 * Every key is prefixed with the account id, and logout wipes the region, so a
 * second account signing in on the same browser never sees the first one's data.
 */

import { readUserCookie } from '@/lib/api/userCookie';

const PREFIX = 'artOffline:v1';

/**
 * Fired whenever a cached copy or a queued write changes, so the global
 * offline banner can show "N รายการรอซิงก์" without polling storage.
 */
export const OFFLINE_CHANGE_EVENT = 'art:offline-change';

function notifyOfflineChange(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(OFFLINE_CHANGE_EVENT));
  } catch {
    // No listeners / older browser: the banner recomputes on the next event.
  }
}

export interface CachedResource<T> {
  data: T;
  savedAt: number;
}

export interface PendingWrite<T> {
  data: T;
  updatedAt: number;
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Cache scope: the signed-in account id, or one shared bucket before login. */
export function offlineScope(): string {
  const cookie = readUserCookie();
  if (cookie && typeof cookie === 'object' && !Array.isArray(cookie)) {
    const id = (cookie as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
    if (typeof id === 'number') return String(id);
  }
  return 'local';
}

function scopedKey(name: string): string {
  return `${PREFIX}:${offlineScope()}:${name}`;
}

/**
 * A per-account storage key for data that is not a cache/pending pair.
 *
 * Exported so no component invents its own unscoped key: the camera stream list
 * used to live under the bare name `artWorkspaceCameraConfig`, which survived
 * logout — the next account on the same browser saw the previous one's cameras.
 */
export function scopedStorageKey(name: string): string {
  return scopedKey(name);
}

function readJson<T>(key: string): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    // Corrupt or foreign value: treat it as "nothing cached" rather than throw.
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode: the network copy is still authoritative.
  }
}

/** Last successfully loaded (or locally saved) copy of a resource. */
export function readCached<T>(name: string): CachedResource<T> | null {
  return readJson<CachedResource<T>>(scopedKey(`cache:${name}`));
}

export function writeCached<T>(name: string, data: T): void {
  writeJson(scopedKey(`cache:${name}`), { data, savedAt: Date.now() });
}

/** Edit that has not been accepted by the server yet. */
export function readPending<T>(name: string): PendingWrite<T> | null {
  return readJson<PendingWrite<T>>(scopedKey(`pending:${name}`));
}

export function writePending<T>(name: string, data: T): void {
  writeJson(scopedKey(`pending:${name}`), { data, updatedAt: Date.now() });
  notifyOfflineChange();
}

export function clearPending(name: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(scopedKey(`pending:${name}`));
  } catch {
    // Nothing to do: a stale marker only costs one extra save attempt.
  }
  notifyOfflineChange();
}

/** Number of resources whose edits are still waiting for a connection. */
export function pendingCount(): number {
  const store = storage();
  if (!store) return 0;
  const marker = `${PREFIX}:${offlineScope()}:pending:`;
  let count = 0;
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && key.startsWith(marker)) count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

/** True when the browser knows it has no connection (server-render safe). */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Keys written before scoping existed. They carry account data under a name that
 * knows nothing about the account, so logout deletes them too.
 */
const LEGACY_ACCOUNT_KEYS = [
  'artWorkspaceCameraConfig',
  'artNotificationReadV2',
  'artNotificationDismissedV2',
];

/** Delete every offline mirror, queued write and legacy account key. */
export function clearOfflineData(): void {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && (key.startsWith(`${PREFIX}:`) || key.startsWith('artNotificationHistoryV1'))) {
        keys.push(key);
      }
    }
    keys.push(...LEGACY_ACCOUNT_KEYS);
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // Storage unavailable; nothing was persisted to begin with.
  }
}
