'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import type { MessageKey } from './messages';
import {
  interpolate,
  setActiveLocale,
  translateKey,
  translateText,
  type Locale,
  type TranslatePair,
} from './translate';

/**
 * Interface language for the whole app.
 *
 * The choice lives in the same preferences store as the era and notification
 * settings, so the settings card is the single switch. `t()` is synchronous and
 * returns Thai as the fallback for anything translated in one language only;
 * `tr()` handles the Thai/English pairs written next to each screen.
 */

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  t: Translate;
  tr: TranslatePair;
}

export { translateText };
export type { Locale, TranslatePair };

const I18nContext = createContext<I18nValue>({
  locale: 'th',
  t: (key, vars) => translateKey('th', key, vars),
  tr: (th, en, vars) => translateText(th, en, vars),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { locale } = usePreferences();

  // Screen readers, the browser's spell checker and module-level helpers all
  // follow the chosen language.
  useEffect(() => {
    setActiveLocale(locale);
    document.documentElement.lang = locale === 'en' ? 'en' : 'th';
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key, vars) => translateKey(locale, key, vars),
      tr: (th, en, vars) => interpolate(locale === 'en' ? en : th, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
