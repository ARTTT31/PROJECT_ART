import type { AppPreferences } from '@/hooks/usePreferences';

/**
 * Date formatting that follows the user's preferences.
 *
 * The Thai calendar is requested explicitly (`-u-ca-gregory`) so the year can be
 * printed by us: that is the only way to offer "พ.ศ." and "ค.ศ." independently
 * of the language used for weekdays and months.
 */

const LOCALE_TAG: Record<AppPreferences['locale'], string> = {
  th: 'th-TH-u-ca-gregory',
  en: 'en-GB',
};

export function formatYear(year: number, preferences: AppPreferences): string {
  return String(preferences.era === 'th' ? year + 543 : year);
}

export function formatLongDate(date: Date, preferences: AppPreferences): string {
  const parts = new Intl.DateTimeFormat(LOCALE_TAG[preferences.locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return `${parts} ${formatYear(date.getFullYear(), preferences)}`;
}

export function formatMonthShort(date: Date, preferences: AppPreferences): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[preferences.locale], { month: 'short' }).format(date);
}

export function formatWeekday(date: Date, preferences: AppPreferences): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[preferences.locale], { weekday: 'long' }).format(date);
}
