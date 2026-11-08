'use client';

import { useEffect, useState } from 'react';
import { SiLine, SiTelegram } from '@icons-pack/react-simple-icons';
import { BellRing, Check, Globe, Loader2, Save, Send } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { showError, showSuccess, showToast } from '@/utils/sweetalert';
import Switch from '@/components/ui/Switch';
import { InsetField, SectionCard } from './SectionCard';

interface NotificationEvents {
  oil_alert: boolean;
  market_alert: boolean;
  daily_summary: boolean;
}

interface ExternalNotificationsState {
  line_token: string;
  line_webhook_url: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  webhook_url: string;
  events: NotificationEvents;
}

const DEFAULT_STATE: ExternalNotificationsState = {
  line_token: '',
  line_webhook_url: '',
  telegram_bot_token: '',
  telegram_chat_id: '',
  webhook_url: '',
  events: {
    oil_alert: true,
    market_alert: true,
    daily_summary: true,
  },
};

export default function ExternalNotificationCard() {
  const [config, setConfig] = useState<ExternalNotificationsState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // Load existing configuration
  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        const res = await fetchWithAuth('/api/v1/profile/external-notifications');
        if (res.ok && isMounted) {
          const resJson = await res.json();
          const data = resJson.data || resJson;
          setConfig({
            line_token: data.line_token || '',
            line_webhook_url: data.line_webhook_url || '',
            telegram_bot_token: data.telegram_bot_token || '',
            telegram_chat_id: data.telegram_chat_id || '',
            webhook_url: data.webhook_url || '',
            events: {
              oil_alert: data.events?.oil_alert ?? true,
              market_alert: data.events?.market_alert ?? true,
              daily_summary: data.events?.daily_summary ?? true,
            },
          });
        }
      } catch (err) {
        console.error('Failed to load external notifications settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetchWithAuth('/api/v1/profile/external-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_token: config.line_token.trim() || null,
          line_webhook_url: config.line_webhook_url.trim() || null,
          telegram_bot_token: config.telegram_bot_token.trim() || null,
          telegram_chat_id: config.telegram_chat_id.trim() || null,
          webhook_url: config.webhook_url.trim() || null,
          events: config.events,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess('บันทึกสำเร็จ', 'อัปเดตการตั้งค่าการแจ้งเตือนภายนอกเรียบร้อยแล้ว');
      } else {
        showError('บันทึกไม่สำเร็จ', apiMessage(data, 'เกิดข้อผิดพลาดในการบันทึก'));
      }
    } catch (err) {
      console.error('Save external notifications error:', err);
      showError('การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async (channel: 'line' | 'telegram' | 'webhook') => {
    setTestingChannel(channel);
    try {
      const res = await fetchWithAuth('/api/v1/profile/external-notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.data?.success || data.result === 'success')) {
        showSuccess('ทดสอบสำเร็จ', data.message || `ส่งข้อความทดสอบไปยัง ${channel} สำเร็จแล้ว`);
      } else {
        showError('ทดสอบไม่สำเร็จ', apiMessage(data, 'ไม่สามารถส่งข้อความทดสอบได้ ตรวจสอบ Token หรือ Chat ID'));
      }
    } catch (err) {
      console.error('Test notification error:', err);
      showError('การเชื่อมต่อล้มเหลว', 'ไม่สามารถส่งข้อความทดสอบได้');
    } finally {
      setTestingChannel(null);
    }
  };

  if (isLoading) {
    return (
      <SectionCard
        icon={<BellRing size={19} aria-hidden="true" />}
        iconBg="bg-emerald-50 dark:bg-emerald-950/30"
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconRing="ring-emerald-200/60 dark:ring-emerald-800/40"
        title="การแจ้งเตือนภายนอก (External Notifications)"
        subtitle="เชื่อมต่อการแจ้งเตือนไปยัง LINE, Telegram หรือ Webhook"
      >
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={<BellRing size={19} aria-hidden="true" />}
      iconBg="bg-emerald-50 dark:bg-emerald-950/30"
      iconColor="text-emerald-600 dark:text-emerald-400"
      iconRing="ring-emerald-200/60 dark:ring-emerald-800/40"
      title="การแจ้งเตือนภายนอก (External Notifications)"
      subtitle="เชื่อมต่อการแจ้งเตือนแบบเฉพาะบุคคลไปยัง LINE, Telegram หรือ Webhook ส่วนตัว"
      badge="Self-Service"
      action={
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-2xs transition-all duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95] disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Save size={13} aria-hidden="true" />
          )}
          <span>{isSaving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</span>
        </button>
      }
    >
      <form onSubmit={handleSave} className="space-y-6">
        {/* LINE Notification Section */}
        <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#06C755]/10 text-[#06C755]">
                <SiLine className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-[var(--ink)]">LINE Messaging / Webhook</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">รับแจ้งเตือนผ่าน LINE Channel Access Token หรือ Webhook</p>
              </div>
            </div>
            <button
              type="button"
              disabled={testingChannel === 'line' || (!config.line_token && !config.line_webhook_url)}
              onClick={() => handleTestNotification('line')}
              className="self-end sm:self-auto inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-40"
            >
              {testingChannel === 'line' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} aria-hidden="true" />
              )}
              <span>ทดสอบ LINE</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InsetField
              label="LINE Access Token"
              type="password"
              placeholder="Channel Access Token หรือ Notify Token"
              value={config.line_token}
              onChange={(v) => setConfig((prev) => ({ ...prev, line_token: v }))}
              icon={<SiLine className="h-4 w-4" aria-hidden="true" />}
              hint="สำหรับ Bot หรือ Notify"
            />
            <InsetField
              label="LINE Webhook URL"
              type="url"
              placeholder="https://api.line.me/v2/bot/message/push หรือ Relay URL"
              value={config.line_webhook_url}
              onChange={(v) => setConfig((prev) => ({ ...prev, line_webhook_url: v }))}
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              hint="ตัวเลือกเสริม"
            />
          </div>
        </div>

        {/* Telegram Notification Section */}
        <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#24A1DE]/10 text-[#24A1DE]">
                <SiTelegram className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-[var(--ink)]">Telegram Bot</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">รับแจ้งเตือนผ่านบอท Telegram ของคุณเอง</p>
              </div>
            </div>
            <button
              type="button"
              disabled={testingChannel === 'telegram' || !config.telegram_bot_token || !config.telegram_chat_id}
              onClick={() => handleTestNotification('telegram')}
              className="self-end sm:self-auto inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-40"
            >
              {testingChannel === 'telegram' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} aria-hidden="true" />
              )}
              <span>ทดสอบ Telegram</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InsetField
              label="Telegram Bot Token"
              type="password"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={config.telegram_bot_token}
              onChange={(v) => setConfig((prev) => ({ ...prev, telegram_bot_token: v }))}
              icon={<SiTelegram className="h-4 w-4" aria-hidden="true" />}
              hint="ได้จาก @BotFather"
            />
            <InsetField
              label="Telegram Chat ID"
              placeholder="เช่น 123456789 หรือ @yourchannel"
              value={config.telegram_chat_id}
              onChange={(v) => setConfig((prev) => ({ ...prev, telegram_chat_id: v }))}
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              hint="Chat หรือ Group ID"
            />
          </div>
        </div>

        {/* Custom Webhook Section */}
        <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Globe className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-[var(--ink)]">Custom Webhook (HTTP POST)</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">ส่ง Payload JSON ไปยัง Discord, Slack, n8n หรือ API ภายนอก</p>
              </div>
            </div>
            <button
              type="button"
              disabled={testingChannel === 'webhook' || !config.webhook_url}
              onClick={() => handleTestNotification('webhook')}
              className="self-end sm:self-auto inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-40"
            >
              {testingChannel === 'webhook' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} aria-hidden="true" />
              )}
              <span>ทดสอบ Webhook</span>
            </button>
          </div>

          <InsetField
            label="Webhook URL"
            type="url"
            placeholder="https://discord.com/api/webhooks/... หรือ https://hook.integromat.com/..."
            value={config.webhook_url}
            onChange={(v) => setConfig((prev) => ({ ...prev, webhook_url: v }))}
            icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            hint="รองรับ HTTP POST JSON"
          />
        </div>

        {/* Subscription Topics */}
        <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-4 sm:p-5 space-y-3">
          <h3 className="text-[13px] font-bold text-[var(--ink)]">หัวข้อการแจ้งเตือนที่ต้องการรับ (Event Subscriptions)</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)]">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[var(--ink)]">แจ้งเตือนราคาน้ำมัน (Oil Price Alert)</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">แจ้งเตือนเมื่อมีการประกาศปรับเปลี่ยนราคาน้ำมันขายปลีก</p>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={config.events.oil_alert}
                  label="แจ้งเตือนราคาน้ำมัน"
                  onChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      events: { ...prev.events, oil_alert: checked },
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)]">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[var(--ink)]">สรุปภาพรวมตลาด (Market Summary Alert)</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">แจ้งเตือนภาพรวมตลาดหุ้น, อัตราแลกเปลี่ยน และดัชนีสำคัญ</p>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={config.events.market_alert}
                  label="สรุปภาพรวมตลาด"
                  onChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      events: { ...prev.events, market_alert: checked },
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)]">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[var(--ink)]">สรุปภาพรวมประจำวัน (Daily Digest)</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">รับสรุปงาน พยากรณ์อากาศ และภารกิจสำคัญประจำวัน</p>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={config.events.daily_summary}
                  label="สรุปภาพรวมประจำวัน"
                  onChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      events: { ...prev.events, daily_summary: checked },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer save reminder */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-[var(--ink-tertiary)]">
            * ข้อมูลการเชื่อมต่อและการตั้งค่าจะถูกเก็บเป็นความลับเฉพาะบัญชีผู้ใช้ของคุณเท่านั้น
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="self-end sm:self-auto inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-white shadow-2xs transition-all duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95] disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} aria-hidden="true" />
            )}
            <span>{isSaving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</span>
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
