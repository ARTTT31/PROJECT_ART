'use client';

import { BellRing, CalendarDays, ListChecks, Volume2 } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { savePreferences, usePreferences } from '@/hooks/usePreferences';
import { playBellSound } from '@/utils/sound';
import { useI18n } from '@/lib/i18n/I18nProvider';
import Switch from '@/components/ui/Switch';

/** Which alerts this browser shows, and whether the bell plays a sound. */
export function NotificationSettingsCard() {
  const { t } = useI18n();
  const preferences = usePreferences();

  return (
    <SectionCard
      icon={<BellRing size={19} aria-hidden="true" />}
      iconBg="bg-amber-50"
      iconColor="text-amber-600"
      iconRing="ring-amber-200/60"
      title={t('card.notifications.title')}
      subtitle={t('card.notifications.subtitle')}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-[18px] bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Volume2 size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">{t('card.notifications.bell.title')}</p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {t('card.notifications.bell.desc')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {preferences.bellSound && (
              <button
                type="button"
                onClick={() => playBellSound()}
                className="rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]"
              >
                {t('card.notifications.bell.test')}
              </button>
            )}
            <Switch
              checked={preferences.bellSound}
              label={t('card.notifications.bell.title')}
              onChange={(next) => savePreferences({ bellSound: next })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-[18px] bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
              {t('card.notifications.holidays.title')}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {t('card.notifications.holidays.desc')}
            </p>
          </div>
          <Switch
            checked={preferences.holidayAlerts}
            label={t('card.notifications.holidays.title')}
            onChange={(next) => savePreferences({ holidayAlerts: next })}
          />
        </div>

        <div className="flex items-center gap-3 rounded-[18px] bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <ListChecks size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
              {t('card.notifications.reminders.title')}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {t('card.notifications.reminders.desc')}
            </p>
          </div>
          <Switch
            checked={preferences.personalReminderAlerts}
            label={t('card.notifications.reminders.title')}
            onChange={(next) => savePreferences({ personalReminderAlerts: next })}
          />
        </div>

        <p className="px-1 pt-1 text-[11px] text-[var(--ink-tertiary)]">
          {t('card.notifications.hint')}
        </p>
      </div>
    </SectionCard>
  );
}

export default NotificationSettingsCard;
