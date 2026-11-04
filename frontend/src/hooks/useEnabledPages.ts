'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api/apiBase';

/**
 * Workspace-wide page switches (`system_settings.enabled_pages`).
 *
 * The admin card writes them; the sidebar and the page guard read them. A cache
 * plus a localStorage copy keeps the first paint correct on a slow connection —
 * a page that is open must not flicker in and out while the request is in
 * flight. Unknown state means "open", the same default the backend applies.
 */

export interface PageSwitch {
  id: string;
  label: string;
  required: boolean;
  /** Admin console / activity log: only an admin can open them. */
  adminOnly?: boolean;
  enabled: boolean;
}

export const DEFAULT_PAGE_SWITCHES: PageSwitch[] = [
  { id: 'dashboard', label: 'หน้าหลัก', required: true, enabled: true },
  { id: 'camera', label: 'กล้องวงจรปิด', required: false, enabled: true },
  { id: 'admin', label: 'จัดการระบบ', required: false, adminOnly: true, enabled: true },
  { id: 'audit', label: 'บันทึกกิจกรรม', required: false, adminOnly: true, enabled: true },
  { id: 'profile', label: 'โปรไฟล์', required: true, enabled: true },
];

/**
 * Fill in flags a cached copy may predate (the admin-only marker is new) and
 * force required/admin-only pages open: they can never be switched off.
 */
function normaliseSwitches(pages: PageSwitch[]): PageSwitch[] {
  return pages.map((page) => {
    const fallback = DEFAULT_PAGE_SWITCHES.find((item) => item.id === page.id);
    const required = Boolean(page.required ?? fallback?.required);
    const adminOnly = Boolean(page.adminOnly ?? fallback?.adminOnly);
    return {
      id: page.id,
      label: page.label || fallback?.label || page.id,
      required,
      adminOnly,
      enabled: required || adminOnly ? true : page.enabled,
    };
  });
}

const STORAGE_KEY = 'artEnabledPagesV1';
const CHANGE_EVENT = 'art:pages-changed';

let cache: PageSwitch[] | null = null;

function readStored(): PageSwitch[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return normaliseSwitches(
      parsed.filter(
        (page): page is PageSwitch =>
          page && typeof page.id === 'string' && typeof page.enabled === 'boolean',
      ),
    );
  } catch {
    return null;
  }
}

function writeStored(pages: PageSwitch[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // Private mode: the in-memory cache still works for this tab.
  }
}

export function getCachedPageSwitches(): PageSwitch[] {
  if (cache) return cache;
  const stored = readStored();
  if (stored) {
    cache = stored;
    return stored;
  }
  return DEFAULT_PAGE_SWITCHES;
}

/** Whether the workspace has page `id` open (unknown ids are allowed). */
export function isPageEnabled(id: string): boolean {
  const match = getCachedPageSwitches().find((page) => page.id === id);
  return match ? match.enabled : true;
}

export async function refreshPageSwitches(): Promise<PageSwitch[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/system/pages`);
    if (!res.ok) return getCachedPageSwitches();
    const body = (await res.json()) as { pages?: PageSwitch[] };
    if (!Array.isArray(body.pages)) return getCachedPageSwitches();
    const pages = normaliseSwitches(body.pages);
    cache = pages;
    writeStored(pages);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
    return pages;
  } catch {
    return getCachedPageSwitches();
  }
}

export function useEnabledPages(): PageSwitch[] {
  const [pages, setPages] = useState<PageSwitch[]>(() => getCachedPageSwitches());

  useEffect(() => {
    let cancelled = false;
    void refreshPageSwitches().then((next) => {
      if (!cancelled) setPages(next);
    });
    const onChange = () => setPages(getCachedPageSwitches());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  return pages;
}
