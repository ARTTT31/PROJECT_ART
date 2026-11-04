'use client';

import { BellRing, CalendarDays, ListChecks, Volume2 } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { savePreferences, usePreferences } from '@/hooks/usePreferences';
import { playBellSound } from '@/utils/sound';
import { useI18n } from '@/lib/i18n/I18nProvider';

function PreferenceSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    // `small-control` opts out of the global button min-height rule in globals.css.
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`small-control relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        checked ? 'bg-[var(--success)]' : 'bg-[var(--surface-chip-2)]'
      }`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-in-out"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

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
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Volume2 size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold tracking-tight text-[var(--ink)]">เสียงกระดิ่ง</p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              เล่นเสียงสั้น ๆ เมื่อมีการแจ้งเตือนใหม่
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {preferences.bellSound && (
              <button
                type="button"
                onClick={() => playBellSound()}
                className="rounded-full bg-[var(--surface-grouped)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]"
              >
                ทดลองเสียง
              </button>
            )}
            <PreferenceSwitch
              checked={preferences.bellSound}
              label="เสียงกระดิ่ง"
              onChange={(next) => savePreferences({ bellSound: next })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold tracking-tight text-[var(--ink)]">
              วันหยุดและวันสำคัญ
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              เตือนล่วงหน้า 7 วันเมื่อใกล้วันหยุด
            </p>
          </div>
          <PreferenceSwitch
            checked={preferences.holidayAlerts}
            label="แจ้งเตือนวันหยุด"
            onChange={(next) => savePreferences({ holidayAlerts: next })}
          />
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <ListChecks size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold tracking-tight text-[var(--ink)]">
              เตือนธุระและวันลาส่วนตัว
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              แสดงรายการ “เตือนของฉัน” ในวิตเจ็ตวันหยุด
            </p>
          </div>
          <PreferenceSwitch
            checked={preferences.personalReminderAlerts}
            label="เตือนธุระและวันลาส่วนตัว"
            onChange={(next) => savePreferences({ personalReminderAlerts: next })}
          />
        </div>

        <p className="px-1 pt-1 text-[10.5px] text-[var(--ink-tertiary)]">
          บันทึกทันทีที่สลับ — มีผลกับเบราว์เซอร์นี้
        </p>
      </div>
    </SectionCard>
  );
}

export default NotificationSettingsCard;
