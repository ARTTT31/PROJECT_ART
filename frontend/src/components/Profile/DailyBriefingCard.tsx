'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Send,
  Loader2,
  Fuel,
  CloudSun,
  TrendingUp,
  CheckSquare,
  Calendar,
  Smartphone,
  MessageSquare,
  Info,
  Sunrise,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { SectionCard } from './SectionCard';
import Switch from '@/components/ui/Switch';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useWebPush } from '@/hooks/useWebPush';
import { showToast } from '@/utils/sweetalert';
import { hapticSuccess, hapticTap } from '@/utils/haptics';

interface BriefingTopics {
  oil_prices: boolean;
  weather: boolean;
  market: boolean;
  tasks: boolean;
  holidays: boolean;
}

const TIME_OPTIONS = ['06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];

/** One row per topic; the icon keeps the list scannable at a glance. */
const TOPICS: {
  key: keyof BriefingTopics;
  icon: LucideIcon;
  name: string;
  desc: string;
  tint: string;
}[] = [
  {
    key: 'oil_prices',
    icon: Fuel,
    name: 'ราคาน้ำมันขายปลีก',
    desc: 'แก๊สโซฮอล์ 95 / ดีเซล',
    tint: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'weather',
    icon: CloudSun,
    name: 'สภาพอากาศ & PM2.5',
    desc: 'อุณหภูมิและคุณภาพอากาศ',
    tint: 'text-sky-600 dark:text-sky-400',
  },
  {
    key: 'market',
    icon: TrendingUp,
    name: 'ตลาดการเงิน & SET',
    desc: 'ดัชนีหุ้นและราคาทองคำ',
    tint: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'tasks',
    icon: CheckSquare,
    name: 'งานค้างใน To-Do',
    desc: 'จำนวนรายการโน้ตด่วน',
    tint: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    key: 'holidays',
    icon: Calendar,
    name: 'วันหยุดนักขัตฤกษ์',
    desc: 'รวมวันหยุดที่จะถึงในสรุป',
    tint: 'text-rose-600 dark:text-rose-400',
  },
];

export function DailyBriefingCard() {
  const webPush = useWebPush();
  const [enabled, setEnabled] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState('07:30');
  const [topics, setTopics] = useState<BriefingTopics>({
    oil_prices: true,
    weather: true,
    market: true,
    tasks: true,
    holidays: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/profile/daily-briefing');
        if (res.ok) {
          const body = await res.json();
          if (active && body?.data) {
            setEnabled(Boolean(body.data.enabled));
            setDeliveryTime(body.data.time || '07:30');
            if (body.data.topics) {
              setTopics((prev) => ({ ...prev, ...body.data.topics }));
            }
          }
        }
      } catch {
        // Fallback to defaults
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const saveSettings = async (
    nextEnabled = enabled,
    nextTime = deliveryTime,
    nextTopics = topics
  ) => {
    setIsSaving(true);
    hapticTap();
    try {
      const res = await fetchWithAuth('/api/v1/profile/daily-briefing', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: nextEnabled,
          time: nextTime,
          topics: nextTopics,
        }),
      });
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      hapticSuccess();
      showToast('บันทึกการตั้งค่าสรุปประจำวันเรียบร้อย', 'success');
    } catch {
      showToast('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTopic = (key: keyof BriefingTopics) => {
    const updated = { ...topics, [key]: !topics[key] };
    setTopics(updated);
    void saveSettings(enabled, deliveryTime, updated);
  };

  const handleTestBriefing = async () => {
    setIsTesting(true);
    hapticTap();
    try {
      const res = await fetchWithAuth('/api/v1/profile/daily-briefing/test', {
        method: 'POST',
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          data?: {
            web_push_sent?: boolean;
            external_sent?: boolean;
            title?: string;
            body?: string;
          };
        };
        const data = payload?.data;
        hapticSuccess();
        if (data?.web_push_sent || data?.external_sent) {
          const channels = [];
          if (data.web_push_sent) channels.push('Web Push');
          if (data.external_sent) channels.push('Telegram/Webhook');
          showToast(`ส่งสรุปทดสอบเรียบร้อย (${channels.join(', ')})`, 'success');
        } else if (
          typeof window !== 'undefined' &&
          'serviceWorker' in navigator &&
          Notification.permission === 'granted'
        ) {
          // Device has permission; display notification locally if server push was simulated
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(data?.title || '☀️ สรุปข้อมูลเช้านี้', {
              body: data?.body || 'ไม่มีงานค้างในโน้ตด่วน พร้อมลุยวันใหม่!',
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-192x192.png',
              data: { url: '/dashboard' },
            });
            showToast('ส่งสรุปทดสอบเข้าอุปกรณ์เรียบร้อย', 'success');
          } catch {
            showToast(
              'ส่งข้อมูลสำเร็จ แต่ยังไม่มีอุปกรณ์เปิดรับการแจ้งเตือน (กรุณาเปิดสวิตช์ Web Push บนมือถือ หรือตั้งค่า Telegram/Webhook)',
              'warning'
            );
          }
        } else {
          showToast(
            'ส่งข้อมูลสำเร็จ แต่ยังไม่มีอุปกรณ์เปิดรับการแจ้งเตือน (กรุณาเปิดสวิตช์ Web Push บนมือถือ หรือตั้งค่า Telegram/Webhook)',
            'warning'
          );
        }
      } else {
        throw new Error('ส่งไม่สำเร็จ');
      }
    } catch {
      showToast('ไม่สามารถส่งสรุปทดสอบได้ ตรวจสอบการเชื่อมต่อแจ้งเตือน', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const activeTopicCount = Object.values(topics).filter(Boolean).length;
  const controlsDisabled = !enabled || isSaving;

  return (
    <SectionCard
      icon={<Clock size={19} aria-hidden="true" />}
      iconBg="bg-blue-50 dark:bg-blue-950/30"
      iconColor="text-blue-600 dark:text-blue-400"
      iconRing="ring-blue-200/60 dark:ring-blue-800/40"
      title="สรุปข้อมูลประจำวันอัตโนมัติ (Daily Push)"
      subtitle="ส่งสรุปข่าวสาร ราคาน้ำมัน สภาพอากาศ และงานค้างให้คุณทุกเช้าตามเวลาที่ตั้งไว้"
    >
      <div className="space-y-4">
        {/* ── Master switch: one calm block showing state, time and reach ── */}
        <div className="overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface-grouped)]">
          <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3.5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-apple-md transition-colors ${
                  enabled
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'bg-[var(--surface-chip)] text-[var(--ink-muted)]'
                }`}
              >
                <Sunrise size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-bold tracking-tight text-[var(--ink)]">
                    สรุปเช้าอัตโนมัติ
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                      enabled
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40'
                        : 'bg-[var(--surface-chip)] text-[var(--ink-muted)] ring-[var(--hairline)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-[var(--ink-tertiary)]'}`}
                    />
                    {enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                  ส่งทุกวัน เวลา{' '}
                  <span className="text-[13px] font-bold text-[var(--ink)]">{deliveryTime}</span> น.
                  <span className="text-[var(--ink-tertiary)]"> · </span>
                  {activeTopicCount} จาก {TOPICS.length} หัวข้อ
                </p>
              </div>
            </div>

            <Switch
              checked={enabled}
              disabled={isLoading || isSaving}
              label="เปิดใช้งานสรุปเช้าอัตโนมัติ"
              onChange={(next) => {
                setEnabled(next);
                void saveSettings(next, deliveryTime, topics);
              }}
            />
          </div>

          {/* Where it lands + a way to preview it */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline-soft)] px-4 py-3 sm:px-5">
            <button
              type="button"
              disabled={isTesting || isLoading}
              onClick={handleTestBriefing}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95] disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={12} aria-hidden="true" />
              )}
              <span>ทดสอบส่ง</span>
            </button>

            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)]">
              <Smartphone
                size={12}
                aria-hidden="true"
                className={webPush.isSubscribed ? 'text-[var(--success)]' : 'text-[var(--ink-tertiary)]'}
              />
              <span className="truncate">
                {webPush.isSubscribed ? 'มือถือ · พร้อม' : 'มือถือ · ยังไม่เปิด'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)]">
              <MessageSquare size={12} aria-hidden="true" className="text-[var(--ink-tertiary)]" />
              <span className="truncate">Telegram / Webhook</span>
            </span>
          </div>
        </div>

        {!isLoading && !enabled && (
          <p className="flex w-full max-w-none items-start gap-1.5 rounded-apple-widget bg-[var(--accent-soft)] px-3 py-2 text-[11px] font-medium leading-relaxed text-[var(--accent-text)]">
            <Info size={13} className="mt-px shrink-0" aria-hidden="true" />
            <span>เปิดสวิตช์ด้านบนก่อน แล้วจึงจะตั้งเวลาและเลือกหัวข้อได้</span>
          </p>
        )}

        {/* ── Delivery time ── */}
        <div className="space-y-2.5 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-2">
            <span
              id="delivery-time-label"
              className="text-[12px] font-bold text-[var(--ink-secondary)]"
            >
              เวลาจัดส่ง
            </span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">ทุกวัน</span>
          </div>
          <div
            role="group"
            aria-labelledby="delivery-time-label"
            className="flex flex-wrap gap-2"
          >
            {TIME_OPTIONS.map((time) => {
              const active = deliveryTime === time;
              return (
                <button
                  key={time}
                  type="button"
                  aria-pressed={active}
                  disabled={controlsDisabled}
                  onClick={() => {
                    setDeliveryTime(time);
                    void saveSettings(enabled, time, topics);
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-apple-2 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'bg-[var(--surface-grouped)] text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]'
                  }`}
                >
                  {time} น.
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Topics: a check list instead of a wall of boxes ── */}
        <div className="space-y-3 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-[var(--ink-secondary)]">
              หัวข้อในสรุป
            </span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">เลือกได้หลายหัวข้อ</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TOPICS.map(({ key, icon: Icon, name, desc, tint }, idx) => {
              const on = topics[key];
              // An odd last row would leave a hole in the two-column grid.
              const spansBoth = idx === TOPICS.length - 1 && TOPICS.length % 2 === 1;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={controlsDisabled}
                  aria-pressed={on}
                  onClick={() => toggleTopic(key)}
                  className={`flex items-center gap-3 rounded-apple-md border p-3 text-left transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${spansBoth ? 'sm:col-span-2' : ''} ${
                    on
                      ? 'border-[var(--accent)] bg-[var(--accent-soft-weak)]'
                      : 'border-[var(--hairline)] bg-[var(--surface-grouped)] hover:bg-[var(--surface-chip)]'
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--surface)] ring-1 ring-[var(--hairline-soft)]">
                    <Icon size={17} aria-hidden="true" className={tint} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[12.5px] font-semibold ${
                        on ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {name}
                    </span>
                    <span className="block truncate text-[10.5px] text-[var(--ink-muted)]">
                      {desc}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
                      on
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-[var(--ink-tertiary)]/40 bg-transparent text-transparent'
                    }`}
                  >
                    <Check size={12} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default DailyBriefingCard;
