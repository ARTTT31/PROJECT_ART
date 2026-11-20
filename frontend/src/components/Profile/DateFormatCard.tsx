'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Check } from 'lucide-react';
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
    <div className="rounded-apple-lg bg-[var(--surface-grouped)] p-1.5 ring-1 ring-[var(--hairline)]">
      <p className="px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-secondary)]">{label}</p>
      <div className="space-y-1" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`!flex w-full min-w-0 items-center gap-2.5 rounded-apple-md px-2.5 py-2.5 text-left transition-all duration-150 active:scale-[0.99] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                selected
                  ? 'bg-[var(--surface)] ring-1 ring-[var(--accent-border)]'
                  : 'hover:bg-[var(--surface-subtle)]'
              }`}
            >
              {/* A radio dot states the choice without a second background
                  block competing with the selected row. */}
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ring-1 ${
                  selected
                    ? 'bg-[var(--accent)] ring-[var(--accent)]'
                    : 'bg-[var(--surface)] ring-[var(--hairline-strong)]'
                }`}
                aria-hidden="true"
              >
                {selected && <Check size={11} strokeWidth={3} className="text-white" />}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[12.5px] font-bold ${
                  selected ? 'text-[var(--ink)]' : 'text-[var(--ink-secondary)]'
                }`}
              >
                {option.label}
              </span>
              <span className="shrink-0 text-[11px] text-[var(--ink-tertiary)]">{option.hint}</span>
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
      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
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
        </div>

        <div className="flex items-center gap-3 rounded-apple-lg bg-[var(--surface-grouped)] p-3.5 ring-1 ring-[var(--hairline)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <CalendarRange size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
              {t('card.dateTime.preview')}
            </p>
            <p className="mt-0.5 truncate text-[15px] font-bold text-[var(--ink)]">
              {preview || '—'}
            </p>
          </div>
        </div>

        <p className="px-1 text-[11px] text-[var(--ink-tertiary)]">
          {t('card.dateTime.hint')}
        </p>
      </div>
    </SectionCard>
  );
}

export default DateFormatCard;
