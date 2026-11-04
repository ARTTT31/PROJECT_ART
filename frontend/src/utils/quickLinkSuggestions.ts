'use client';

import type { MainMenuItemConfig } from './mainMenu';
import type { QuickLink, QuickLinkIconKey } from './quickLinks';

/**
 * "You keep opening this — save it as a shortcut?"
 *
 * The suggestion is the inverse of a bookmark: instead of the person having to
 * remember that a page exists, the workspace notices the pattern. Visits are a
 * display aid only, so they stay in this browser and never reach the database.
 */

export const PAGE_VISITS_KEY = 'artPageVisitsV1';
export const SUGGESTION_DISMISSED_KEY = 'artQuickLinkSuggestionDismissedV1';
export const SUGGESTION_THRESHOLD = 3;

export interface PageVisits {
  [path: string]: { count: number; lastAt: number };
}

export interface QuickLinkSuggestion {
  path: string;
  label: string;
  count: number;
  icon: QuickLinkIconKey;
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function storage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

/** Pages that are never worth offering as a shortcut. */
const AUTH_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/login-success',
];

const PAGE_META: Record<string, { label: string; icon: QuickLinkIconKey }> = {
  dashboard: { label: 'หน้าหลัก', icon: 'home' },
  camera: { label: 'กล้องวงจรปิด', icon: 'camera' },
  audit: { label: 'บันทึกกิจกรรม', icon: 'shield' },
  admin: { label: 'จัดการระบบ', icon: 'shield' },
  profile: { label: 'โปรไฟล์', icon: 'users' },
};

/** Strip query/hash and trailing slashes; null for pages we ignore. */
export function normalizePath(pathname: string): string | null {
  if (!pathname) return null;
  const [path] = pathname.split(/[?#]/);
  if (!path || path === '/') return null;
  const trimmed = path.replace(/\/+$/, '');
  if (!trimmed) return null;
  if (AUTH_PATHS.some((auth) => trimmed === auth || trimmed.startsWith(`${auth}/`))) return null;
  return trimmed;
}

export function readPageVisits(store: StorageLike | null = storage()): PageVisits {
  if (!store) return {};
  try {
    const raw = store.getItem(PAGE_VISITS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as PageVisits)
      : {};
  } catch {
    return {};
  }
}

/** Count one visit of `pathname` and return the updated map. */
export function recordPageVisit(
  pathname: string,
  store: StorageLike | null = storage(),
): PageVisits {
  const visits = readPageVisits(store);
  const path = normalizePath(pathname);
  if (!store || !path) return visits;

  const previous = visits[path];
  const next: PageVisits = {
    ...visits,
    [path]: { count: (previous?.count ?? 0) + 1, lastAt: Date.now() },
  };
  try {
    store.setItem(PAGE_VISITS_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: no suggestion is better than a broken sidebar */
  }
  return next;
}

export function dismissQuickLinkSuggestion(
  path: string,
  store: StorageLike | null = storage(),
): void {
  if (!store) return;
  const dismissed = readDismissedSuggestions(store);
  if (dismissed.includes(path)) return;
  try {
    store.setItem(SUGGESTION_DISMISSED_KEY, JSON.stringify([...dismissed, path]));
  } catch {
    /* ignore */
  }
}

export function readDismissedSuggestions(store: StorageLike | null = storage()): string[] {
  if (!store) return [];
  try {
    const raw = store.getItem(SUGGESTION_DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function describePath(path: string): { label: string; icon: QuickLinkIconKey } {
  const segments = path.split('/').filter(Boolean);
  const known = PAGE_META[segments[0] ?? ''];
  // A page root keeps its product name; a deep link is named by its own last
  // segment ("gate-1" is more useful than a second "กล้องวงจรปิด") but keeps the
  // page's icon so it still looks like it belongs there.
  if (known && segments.length === 1) return known;
  const last = segments[segments.length - 1] ?? path;
  return { label: last.replace(/[-_]+/g, ' '), icon: known?.icon ?? 'link' };
}

/**
 * The visited page worth turning into a shortcut.
 *
 * Only paths that are *not already one click away* qualify: a page in the
 * enabled main menu is already reachable, so suggesting it would add noise.
 * Deep links (`/camera/gate-1`) and pages the user hid from their menu are the
 * real candidates.
 */
export function findQuickLinkSuggestion(options: {
  visits: PageVisits;
  links: QuickLink[];
  mainMenu: MainMenuItemConfig[];
  dismissed?: string[];
  threshold?: number;
  store?: StorageLike | null;
}): QuickLinkSuggestion | null {
  const { visits, links, mainMenu } = options;
  const threshold = options.threshold ?? SUGGESTION_THRESHOLD;

  const dismissed = new Set([
    ...readDismissedSuggestions(options.store ?? storage()),
    ...(options.dismissed ?? []),
  ]);

  // A page that is already a shortcut, or already in the main menu, needs no
  // suggestion. The menu is ordering-only now — visibility comes from the admin
  // page switches — so every menu entry counts as claimed.
  const claimed = new Set(
    [...links.map((link) => link.url), ...mainMenu.map((item) => item.href)]
      .map((url) => normalizePath(url))
      .filter((path): path is string => Boolean(path)),
  );

  let best: { path: string; count: number; lastAt: number } | null = null;
  for (const [path, visit] of Object.entries(visits)) {
    if (!visit || typeof visit.count !== 'number') continue;
    if (visit.count < threshold || dismissed.has(path) || claimed.has(path)) continue;
    const lastAt = typeof visit.lastAt === 'number' ? visit.lastAt : 0;
    if (
      !best ||
      visit.count > best.count ||
      (visit.count === best.count && lastAt > best.lastAt)
    ) {
      best = { path, count: visit.count, lastAt };
    }
  }

  if (!best) return null;
  return { path: best.path, count: best.count, ...describePath(best.path) };
}
