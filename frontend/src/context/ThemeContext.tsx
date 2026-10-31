'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type AccentId =
  | 'blue'
  | 'teal'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'green'
  | 'graphite';

export interface ThemeAccent {
  id: AccentId;
  label: string;
  /** Solid colour used for the swatch and by :root[data-accent='…']. */
  color: string;
}

/** Accent presets. The hex values mirror the `data-accent` blocks in globals.css. */
export const THEME_ACCENTS: ThemeAccent[] = [
  { id: 'blue', label: 'ฟ้า', color: '#0066cc' },
  { id: 'teal', label: 'เขียวน้ำทะเล', color: '#0f766e' },
  { id: 'indigo', label: 'คราม', color: '#4f46e5' },
  { id: 'purple', label: 'ม่วง', color: '#7c3aed' },
  { id: 'pink', label: 'ชมพู', color: '#db2777' },
  { id: 'orange', label: 'ส้ม', color: '#c2410c' },
  { id: 'green', label: 'เขียว', color: '#15803d' },
  { id: 'graphite', label: 'ดำเทา', color: '#1d1d1f' },
];

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'ตามระบบ' },
  { id: 'light', label: 'สว่าง' },
  { id: 'dark', label: 'มืด' },
];

export const THEME_STORAGE_KEY = 'art_theme_settings';

interface ThemeSettings {
  mode: ThemeMode;
  accent: AccentId;
}

const DEFAULT_SETTINGS: ThemeSettings = { mode: 'system', accent: 'blue' };

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentId;
  /** What is actually painted right now ('system' resolved through the OS). */
  resolvedMode: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: DEFAULT_SETTINGS.mode,
  accent: DEFAULT_SETTINGS.accent,
  resolvedMode: 'light',
  setMode: () => {},
  setAccent: () => {},
  resetTheme: () => {},
});

function isMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isAccent(value: unknown): value is AccentId {
  return THEME_ACCENTS.some((accent) => accent.id === value);
}

/** The settings the pre-paint script in app/layout.tsx reads; same shape/key. */
function readStoredSettings(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    return {
      mode: isMode(parsed.mode) ? parsed.mode : DEFAULT_SETTINGS.mode,
      accent: isAccent(parsed.accent) ? parsed.accent : DEFAULT_SETTINGS.accent,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Theme state for the whole app.
 *
 * The palette itself lives in globals.css: the provider only writes
 * `data-theme` / `data-accent` on <html>, which is also what the inline script
 * in the root layout does before the first paint. Keeping it that way means a
 * dark-mode reload never flashes white.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(readStoredSettings);
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  const resolvedMode: ResolvedTheme =
    settings.mode === 'system' ? (prefersDark ? 'dark' : 'light') : settings.mode;

  // Follow the OS while the user is on "ตามระบบ".
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedMode;
    root.dataset.accent = settings.accent;
    root.style.colorScheme = resolvedMode;
  }, [resolvedMode, settings.accent]);

  const persist = useCallback((next: ThemeSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage disabled (private mode): the choice still applies this session.
    }
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => persist({ ...settings, mode }),
    [persist, settings],
  );
  const setAccent = useCallback(
    (accent: AccentId) => persist({ ...settings, accent }),
    [persist, settings],
  );
  const resetTheme = useCallback(() => persist(DEFAULT_SETTINGS), [persist]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode: settings.mode,
      accent: settings.accent,
      resolvedMode,
      setMode,
      setAccent,
      resetTheme,
    }),
    [settings.mode, settings.accent, resolvedMode, setMode, setAccent, resetTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
