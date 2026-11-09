'use client';

import { useState, useEffect } from 'react';
import { Clock, Send, Loader2, Fuel, CloudSun, TrendingUp, CheckSquare, Calendar, Smartphone, MessageSquare } from 'lucide-react';
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
        const payload = (await res.json()) as { data?: { web_push_sent?: boolean; external_sent?: boolean } };
        const data = payload?.data;
        hapticSuccess();
        if (data?.web_push_sent || data?.external_sent) {
          const channels = [];
          if (data.web_push_sent) channels.push('Web Push');
          if (data.external_sent) channels.push('LINE/Telegram');
          showToast(`ส่งสรุปทดสอบเรียบร้อย (${channels.join(', ')})`, 'success');
        } else {
          showToast(
            'ส่งข้อมูลสำเร็จ แต่ยังไม่มีอุปกรณ์เปิดรับการแจ้งเตือน (กรุณาเปิดสวิตช์ Web Push บนมือถือ หรือตั้งค่า LINE/Telegram)',
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

  return (
    <SectionCard
      icon={<Clock size={19} aria-hidden="true" />}
      iconBg="bg-blue-50"
      iconColor="text-blue-600"
      iconRing="ring-blue-200/60"
      title="สรุปข้อมูลประจำวันอัตโนมัติ (Daily Push)"
      subtitle="ตั้งเวลาส่ง Push Notification สรุปภาพรวมข่าวสาร ราคาน้ำมัน สภาพอากาศ และงานค้าง"
    >
      <div className="space-y-4">
        {/* Main Master Switch */}
        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--surface)] p-3.5 ring-1 ring-[var(--hairline)] shadow-2xs">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold tracking-tight text-[var(--ink)]">
              เปิดใช้งานการส่งสรุปเช้าอัตโนมัติ
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
              ระบบจะรวบรวมข้อมูลสำคัญและยิงการแจ้งเตือนตามเวลาที่คุณระบุ
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              disabled={isTesting || isLoading}
              onClick={handleTestBriefing}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-chip)] active:scale-[0.97] disabled:opacity-50"
            >
              {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              <span>ทดสอบส่ง</span>
            </button>
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
        </div>

        {/* Delivery Channels Status Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[var(--surface-grouped)] px-3.5 py-2.5 text-[11px] ring-1 ring-[var(--hairline)]">
          <div className="flex items-center gap-1.5 font-bold text-[var(--ink-secondary)]">
            <span>ช่องทางจัดส่งการแจ้งเตือน:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                webPush.isSubscribed
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60'
              }`}
            >
              <Smartphone size={12} aria-hidden="true" />
              <span>
                {webPush.isSubscribed
                  ? 'แจ้งเตือนเข้ามือถือ (Web Push) พร้อมส่ง ✅'
                  : 'แจ้งเตือนเข้ามือถือ (Web Push) ยังไม่เปิดสวิตช์'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-200/60">
              <MessageSquare size={12} aria-hidden="true" />
              <span>LINE / Telegram (เสริมถ้าเชื่อมต่อ)</span>
            </span>
          </div>
        </div>

        {/* Delivery Time Selection */}
        <div className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--hairline)] space-y-2">
          <label htmlFor="delivery-time-select" className="block text-[12px] font-bold text-[var(--ink-secondary)]">
            เวลาจัดส่งการแจ้งเตือน
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((time) => {
              const active = deliveryTime === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    setDeliveryTime(time);
                    void saveSettings(enabled, time, topics);
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-apple-2 active:scale-[0.95] ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'bg-[var(--surface-grouped)] text-[var(--ink-secondary)] hover:bg-[var(--surface-chip)] ring-1 ring-[var(--hairline)]'
                  }`}
                >
                  {time} น.
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic Checkboxes */}
        <div className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--hairline)] space-y-2.5">
          <span className="block text-[12px] font-bold text-[var(--ink-secondary)]">
            เลือกหัวข้อเนื้อหาที่ต้องการสรุป
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {/* 1. Oil Prices */}
            <button
              type="button"
              onClick={() => toggleTopic('oil_prices')}
              className={`flex items-center gap-2.5 rounded-[12px] p-2.5 text-left border transition-all active:scale-[0.98] ${
                topics.oil_prices
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/40 text-[var(--ink)]'
                  : 'border-[var(--hairline)] bg-[var(--surface-grouped)] text-[var(--ink-muted)]'
              }`}
            >
              <Fuel className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold">ราคาน้ำมันขายปลีก</span>
                <span className="text-[10px] text-[var(--ink-muted)]">แก๊สโซฮอล์ 95 / ดีเซล</span>
              </div>
            </button>

            {/* 2. Weather & PM2.5 */}
            <button
              type="button"
              onClick={() => toggleTopic('weather')}
              className={`flex items-center gap-2.5 rounded-[12px] p-2.5 text-left border transition-all active:scale-[0.98] ${
                topics.weather
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/40 text-[var(--ink)]'
                  : 'border-[var(--hairline)] bg-[var(--surface-grouped)] text-[var(--ink-muted)]'
              }`}
            >
              <CloudSun className="h-4 w-4 shrink-0 text-sky-500" />
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold">สภาพอากาศ & PM2.5</span>
                <span className="text-[10px] text-[var(--ink-muted)]">อุณหภูมิและคุณภาพอากาศ</span>
              </div>
            </button>

            {/* 3. Market */}
            <button
              type="button"
              onClick={() => toggleTopic('market')}
              className={`flex items-center gap-2.5 rounded-[12px] p-2.5 text-left border transition-all active:scale-[0.98] ${
                topics.market
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/40 text-[var(--ink)]'
                  : 'border-[var(--hairline)] bg-[var(--surface-grouped)] text-[var(--ink-muted)]'
              }`}
            >
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold">ตลาดการเงิน & SET</span>
                <span className="text-[10px] text-[var(--ink-muted)]">ดัชนีหุ้นและราคาทองคำ</span>
              </div>
            </button>

            {/* 4. Tasks */}
            <button
              type="button"
              onClick={() => toggleTopic('tasks')}
              className={`flex items-center gap-2.5 rounded-[12px] p-2.5 text-left border transition-all active:scale-[0.98] ${
                topics.tasks
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/40 text-[var(--ink)]'
                  : 'border-[var(--hairline)] bg-[var(--surface-grouped)] text-[var(--ink-muted)]'
              }`}
            >
              <CheckSquare className="h-4 w-4 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold">งานค้างใน To-Do</span>
                <span className="text-[10px] text-[var(--ink-muted)]">จำนวนรายการโน้ตด่วน</span>
              </div>
            </button>

            {/* 5. Holidays */}
            <button
              type="button"
              onClick={() => toggleTopic('holidays')}
              className={`flex items-center gap-2.5 rounded-[12px] p-2.5 text-left border transition-all active:scale-[0.98] ${
                topics.holidays
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/40 text-[var(--ink)]'
                  : 'border-[var(--hairline)] bg-[var(--surface-grouped)] text-[var(--ink-muted)]'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold">วันหยุดนักขัตฤกษ์</span>
                <span className="text-[10px] text-[var(--ink-muted)]">วันหยุดราชการใกล้ถึง</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default DailyBriefingCard;
