'use client';

import { useEffect, useState } from 'react';

/**
 * Per-browser display and notification preferences.
 *
 * These are presentation choices, not workspace policy, so they stay in
 * localStorage instead of the database: one device can show Buddhist years in
 * Thai while another prefers Gregorian dates in English. Components read them
 * through `usePreferences()` so a change in the settings tab applies everywhere
 * at once.
 */

export type DateEra = 'th' | 'intl';
export type UiLocale = 'th' | 'en';

export interface AppPreferences {
  /** Short chime when a new notification arrives. */
  bellSound: boolean;
  /** Holiday alerts in the bell feed. */
  holidayAlerts: boolean;
  /** The personal errand / leave list in the holiday widget. */
  personalReminderAlerts: boolean;
  /** พ.ศ. or ค.ศ. in dates. */
  era: DateEra;
  /** Thai or English names for months and weekdays. */
  locale: UiLocale;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  bellSound: true,
  holidayAlerts: true,
  personalReminderAlerts: true,
  era: 'th',
  locale: 'th',
};

const STORAGE_KEY = 'artPreferencesV1';
const CHANGE_EVENT = 'art:preferences-changed';

export function readPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AppPreferences> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(patch: Partial<AppPreferences>): AppPreferences {
  const next = { ...readPreferences(), ...patch };
  if (typeof window === 'undefined') return next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the change still applies for this page load.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}

export function usePreferences(): AppPreferences {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const sync = () => setPreferences(readPreferences());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return preferences;
}
