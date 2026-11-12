'use client';

import { useEffect, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { savePreferences, usePreferences, type DateEra, type UiLocale } from '@/hooks/usePreferences';
import { formatLongDate } from '@/utils/dateFormat';
import { useI18n } from '@/lib/i18n/I18nProvider';

const ERA_OPTIONS: Array<{ value: DateEra; label: string; hint: string }> = [
  { value: 'th', label: 'พ.ศ.', hint: 'เช่น 2569' },
  { value: 'intl', label: 'ค.ศ.', hint: 'เช่น 2026' },
];

const LOCALE_OPTIONS: Array<{ value: UiLocale; label: string; hint: string }> = [
  { value: 'th', label: 'ภาษาไทย', hint: 'พฤหัสบดี 5 พฤศจิกายน' },
  { value: 'en', label: 'English', hint: 'Thursday 5 November' },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold text-[var(--ink-secondary)]">{label}</p>
      <div
        className="grid grid-cols-2 gap-2 rounded-apple-lg bg-[var(--surface-grouped)] p-1.5 ring-1 ring-[var(--hairline)]"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`!flex !flex-col items-center justify-center gap-1 rounded-apple-md px-3 py-2.5 text-center transition-all duration-150 active:scale-[0.98] ${
                selected
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs ring-1 ring-[var(--hairline)]'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]'
              }`}
            >
              <span
                className={`text-[13px] font-bold ${
                  selected ? 'text-[var(--ink)]' : 'text-[var(--ink-secondary)]'
                }`}
              >
                {option.label}
              </span>
              <span className="text-[11px] font-normal text-[var(--ink-tertiary)]">
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Year era and language used for dates across the workspace. */
export function DateFormatCard() {
  const { t } = useI18n();
  const preferences = usePreferences();
  // Formatted after mount: the server render has no reliable "today".
  const [preview, setPreview] = useState('');

  useEffect(() => {
    setPreview(formatLongDate(new Date(), preferences));
  }, [preferences]);

  return (
    <SectionCard
      icon={<CalendarRange size={19} aria-hidden="true" />}
      iconBg="bg-sky-50"
      iconColor="text-sky-600"
      iconRing="ring-sky-200/60"
      title={t('card.dateTime.title')}
      subtitle={t('card.dateTime.subtitle')}
    >
      <div className="space-y-4">
        <Segmented
          label={t('card.dateTime.era')}
          value={preferences.era}
          options={ERA_OPTIONS}
          onChange={(next) => savePreferences({ era: next })}
        />
        <Segmented
          label={t('card.dateTime.lang')}
          value={preferences.locale}
          options={LOCALE_OPTIONS}
          onChange={(next) => savePreferences({ locale: next })}
        />

        <div className="rounded-apple-widget bg-[var(--surface-subtle)] px-4 py-3 ring-1 ring-[var(--hairline)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
            {t('card.dateTime.preview')}
          </p>
          <p className="mt-1 text-[14px] font-bold text-[var(--ink)]">
            {preview || '—'}
          </p>
        </div>

        <p className="px-1 text-[11px] text-[var(--ink-tertiary)]">
          {t('card.dateTime.hint')}
        </p>
      </div>
    </SectionCard>
  );
}

export default DateFormatCard;
