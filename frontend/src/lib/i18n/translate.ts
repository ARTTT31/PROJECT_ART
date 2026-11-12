import { messages, type MessageKey } from './messages';

/**
 * Translation helpers shared by React and non-React code.
 *
 * Two kinds of copy live in the app:
 * - Shared labels (navigation, page names, widgets) live in `messages.ts` and are
 *   looked up with a stable key through `t()`.
 * - Screen-specific copy lives next to the JSX it belongs to and is written as a
 *   Thai/English pair through `tr()`. Keeping the pair together means a new
 *   string cannot ship in one language only.
 */

export type Locale = 'th' | 'en';

export type TranslatePair = (
  th: string,
  en: string,
  vars?: Record<string, string | number>,
) => string;

/** Locale used by module-level helpers that cannot read React context. */
let activeLocale: Locale = 'th';

/** Called by `I18nProvider` whenever the preference changes. */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template,
  );
}

export function translateKey(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = messages[locale][key] ?? messages.th[key];
  return interpolate(template, vars);
}

/** Translate an inline Thai/English pair for non-React modules. */
export function translateText(
  th: string,
  en: string,
  vars?: Record<string, string | number>,
): string {
  return interpolate(activeLocale === 'en' ? en : th, vars);
}
