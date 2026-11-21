'use client';

import { BellRing, CalendarDays, Globe, ListChecks, Loader2, Volume2 } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { savePreferences, usePreferences } from '@/hooks/usePreferences';
import { useWebPush } from '@/hooks/useWebPush';
import { playBellSound } from '@/utils/sound';
import { useI18n } from '@/lib/i18n/I18nProvider';
import Switch from '@/components/ui/Switch';

/** Which alerts this browser shows, bell sounds, and Web Push notifications. */
export function NotificationSettingsCard() {
  const { t } = useI18n();
  const preferences = usePreferences();
  const webPush = useWebPush();

  // One short sentence, saying what the switch does or what is blocking it.
  const pushHint = !webPush.isSupported
    ? 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push'
    : webPush.permission === 'denied'
            ? 'เบราว์เซอร์ปิดกั้นอยู่ — กดไอคอนกุญแจข้างช่องที่อยู่ แล้วอนุญาตการแจ้งเตือน'
      : webPush.isSubscribed
        ? 'อุปกรณ์นี้จะได้รับแจ้งเตือนทันที แม้ปิดหน้าเว็บอยู่'
        : 'เปิดสวิตช์เพื่อให้อุปกรณ์นี้รับแจ้งเตือน แม้ปิดหน้าเว็บอยู่';

  return (
    <SectionCard
      icon={<BellRing size={19} aria-hidden="true" />}
      iconBg="bg-[var(--warning-soft)]"
      iconColor="text-[var(--warning-ink)]"
      iconRing="ring-[var(--hairline-strong)]"
      title={t('card.notifications.title')}
      subtitle={t('card.notifications.subtitle')}
    >
      <div className="space-y-3">
        {/* Apple Inset Grouped Container */}
        <div className="overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] shadow-2xs divide-y divide-[var(--hairline)]">
          {/* Web Push Notification */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[var(--surface-subtle)] transition-colors">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Globe size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
                    แจ้งเตือนเข้าเครื่องนี้ (Web Push)
                  </p>
                  {!webPush.isSupported ? (
                    <span className="rounded-full bg-[var(--surface-chip)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-secondary)]">
                      ไม่รองรับ
                    </span>
                  ) : webPush.permission === 'denied' ? (
                    <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--danger-ink)]">
                      ถูกปิดกั้น
                    </span>
                  ) : webPush.isSubscribed ? (
                    <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success-ink)]">
                      เปิดใช้งานแล้ว
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--surface-chip)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-secondary)]">
                      ยังไม่เปิด
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                  {pushHint}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--hairline-soft)] pt-2 sm:border-t-0 sm:pt-0">
              {webPush.isSubscribed && (
                <button
                  type="button"
                  onClick={() => webPush.sendTestNotification()}
                  aria-label="ส่งการแจ้งเตือนทดสอบ"
                  disabled={webPush.isTesting || webPush.isLoading}
                  className="rounded-full bg-[var(--surface-grouped)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95] disabled:opacity-50 ring-1 ring-[var(--hairline)]"
                >
                  {webPush.isTesting ? (
                    <span className="flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      กำลังส่ง...
                    </span>
                  ) : (
                    'ส่งทดสอบ'
                  )}
                </button>
              )}
              <Switch
                checked={webPush.isSubscribed}
                disabled={!webPush.isSupported || webPush.isLoading}
                label="การแจ้งเตือนบนเบราว์เซอร์"
                onChange={(next) => {
                  if (next) {
                    webPush.subscribe();
                  } else {
                    webPush.unsubscribe();
                  }
                }}
              />
            </div>
          </div>

          {/* Bell Sound */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[var(--surface-subtle)] transition-colors">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Volume2 size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
                  {t('card.notifications.bell.title')}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                  {t('card.notifications.bell.desc')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--hairline-soft)] pt-2 sm:border-t-0 sm:pt-0">
              {preferences.bellSound && (
                <button
                  type="button"
                  onClick={() => playBellSound()}
                  className="rounded-full bg-[var(--surface-grouped)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95] ring-1 ring-[var(--hairline)]"
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

          {/* Holiday Alerts */}
          <div className="flex items-center justify-between gap-3 p-4 hover:bg-[var(--surface-subtle)] transition-colors">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <CalendarDays size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
                  {t('card.notifications.holidays.title')}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                  {t('card.notifications.holidays.desc')}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Switch
                checked={preferences.holidayAlerts}
                label={t('card.notifications.holidays.title')}
                onChange={(next) => savePreferences({ holidayAlerts: next })}
              />
            </div>
          </div>

          {/* Personal Reminder Alerts */}
          <div className="flex items-center justify-between gap-3 p-4 hover:bg-[var(--surface-subtle)] transition-colors">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <ListChecks size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
                  {t('card.notifications.reminders.title')}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                  {t('card.notifications.reminders.desc')}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Switch
                checked={preferences.personalReminderAlerts}
                label={t('card.notifications.reminders.title')}
                onChange={(next) => savePreferences({ personalReminderAlerts: next })}
              />
            </div>
          </div>
        </div>

        <p className="px-1 text-[11px] text-[var(--ink-tertiary)]">
          {t('card.notifications.hint')}
        </p>
      </div>
    </SectionCard>
  );
}

export default NotificationSettingsCard;
