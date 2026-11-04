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
  { value: 'th', label: 'ไทย', hint: 'พฤหัสบดี 5 พฤศจิกายน' },
  { value: 'en', label: 'อังกฤษ', hint: 'Thursday 5 November' },
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
      <p className="mb-1.5 text-[11.5px] font-bold text-[var(--ink-muted)]">{label}</p>
      <div
        className="inline-flex w-full rounded-full bg-[var(--surface-chip)] p-0.5"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`flex-1 rounded-full px-3 py-1.5 text-center transition-all duration-150 ${
              value === option.value
                ? 'bg-[var(--surface)] shadow-xs'
                : 'hover:bg-[var(--glass-60)]'
            }`}
          >
            <span
              className={`block text-[12px] font-bold ${
                value === option.value ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              {option.label}
            </span>
            <span className="block text-[9.5px] text-[var(--ink-tertiary)]">{option.hint}</span>
          </button>
        ))}
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

        <div className="rounded-[14px] bg-[var(--surface-subtle)] px-3 py-2.5 ring-1 ring-[var(--hairline)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
            {t('card.dateTime.preview')}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-[var(--ink)]">
            {preview || '—'}
          </p>
        </div>

        <p className="px-1 text-[10.5px] text-[var(--ink-tertiary)]">
          {t('card.dateTime.hint')}
        </p>
      </div>
    </SectionCard>
  );
}

export default DateFormatCard;
