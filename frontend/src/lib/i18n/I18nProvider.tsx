'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import { messages, type MessageKey } from './messages';

/**
 * Interface language for the whole app.
 *
 * The choice lives in the same preferences store as the era and notification
 * settings, so the settings card is the single switch. `t()` is synchronous and
 * returns Thai as the fallback for anything translated in one language only.
 */

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: 'th' | 'en';
  t: Translate;
}

function translate(locale: 'th' | 'en', key: MessageKey, vars?: Record<string, string | number>) {
  const template = messages[locale][key] ?? messages.th[key];
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template,
  );
}

const I18nContext = createContext<I18nValue>({
  locale: 'th',
  t: (key, vars) => translate('th', key, vars),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { locale } = usePreferences();

  // Screen readers and the browser's spell checker follow the chosen language.
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'th';
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
