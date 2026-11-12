'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cpu, Globe, KeyRound, Loader2, PlugZap, Save, Sparkles, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { showConfirm, showError, showSuccess } from '@/utils/sweetalert';
import Select from '@/components/ui/Select';
import { InsetField, SectionCard } from './SectionCard';

type AIProviderName = 'gemini' | 'openai';
type AISettingsSource = 'user' | 'server' | 'none';

interface AISettings {
  provider: AIProviderName;
  has_key: boolean;
  base_url: string;
  model: string;
  source: AISettingsSource;
}

const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI-compatible (Z.ai, OpenRouter, …)' },
];

const DEFAULT_LABELS: Record<AISettingsSource, { title: string; body: string }> = {
  user: {
    title: 'เชื่อมต่อด้วยคีย์ของคุณ',
    body: 'แชทของบัญชีนี้จะเรียกผู้ให้บริการที่คุณตั้งไว้',
  },
  server: {
    title: 'ใช้คีย์ของเซิร์ฟเวอร์',
    body: 'ยังไม่ได้ตั้งคีย์ส่วนตัว ระบบใช้ผู้ให้บริการที่ผู้ดูแลระบบตั้งไว้ให้',
  },
  none: {
    title: 'ยังไม่ได้เชื่อมต่อ',
    body: 'ตอนนี้ใช้ตัวช่วยตอบกลับพื้นฐาน ใส่คีย์ด้านล่างเพื่อให้แชทฉลาดขึ้น',
  },
};

export default function AISettingsCard() {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'gemini',
    has_key: false,
    base_url: '',
    model: '',
    source: 'none',
  });
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const applySettings = useCallback((data: AISettings) => {
    setSettings({
      provider: data.provider === 'openai' ? 'openai' : 'gemini',
      has_key: Boolean(data.has_key),
      base_url: data.base_url || '',
      model: data.model || '',
      source: data.source || 'none',
    });
    setBaseUrl(data.base_url || '');
    setModel(data.model || '');
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await fetchWithAuth('/api/v1/ai/settings');
        if (res.ok && isMounted) {
          const body = await res.json();
          applySettings(body.data || body);
        }
      } catch (err) {
        console.error('Failed to load AI settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [applySettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetchWithAuth('/api/v1/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          api_key: apiKey.trim() || null,
          base_url: settings.provider === 'openai' ? baseUrl.trim() || null : null,
          model: model.trim() || null,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        applySettings(body.data || body);
        setApiKey('');
        showSuccess('บันทึกสำเร็จ', body.message || 'บันทึกการเชื่อมต่อ AI เรียบร้อยแล้ว');
      } else {
        showError('บันทึกไม่สำเร็จ', apiMessage(body, 'ตรวจสอบ API Key และ Base URL อีกครั้ง'));
      }
    } catch (err) {
      console.error('Save AI settings error:', err);
      showError('การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetchWithAuth('/api/v1/ai/settings/test', { method: 'POST' });
      const body = await res.json();
      if (res.ok) {
        showSuccess('ทดสอบสำเร็จ', body.message || 'ผู้ให้บริการตอบกลับปกติ');
      } else {
        showError('ทดสอบไม่สำเร็จ', apiMessage(body, 'ตรวจสอบ API Key, Model และ Base URL'));
      }
    } catch (err) {
      console.error('Test AI settings error:', err);
      showError('การเชื่อมต่อล้มเหลว', 'ไม่สามารถทดสอบผู้ให้บริการได้');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    const result = await showConfirm(
      'ลบการเชื่อมต่อ AI?',
      'คีย์ที่บันทึกไว้ในบัญชีนี้จะถูกลบ และแชทจะกลับไปใช้การตั้งค่าของเซิร์ฟเวอร์',
    );
    if (!result.isConfirmed) return;

    try {
      const res = await fetchWithAuth('/api/v1/ai/settings', { method: 'DELETE' });
      const body = await res.json();
      if (res.ok) {
        applySettings(body.data || body);
        setApiKey('');
        showSuccess('ลบแล้ว', body.message || 'ลบการเชื่อมต่อ AI ของบัญชีนี้แล้ว');
      } else {
        showError('ลบไม่สำเร็จ', apiMessage(body, 'ไม่สามารถลบการตั้งค่าได้'));
      }
    } catch (err) {
      console.error('Delete AI settings error:', err);
      showError('การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  if (isLoading) {
    return (
      <SectionCard
        icon={<Sparkles size={19} aria-hidden="true" />}
        iconBg="bg-violet-50 dark:bg-violet-950/30"
        iconColor="text-violet-600 dark:text-violet-400"
        iconRing="ring-violet-200/60 dark:ring-violet-800/40"
        title="เชื่อมต่อ AI Chat (API Key)"
        subtitle="ใช้คีย์ของผู้ให้บริการของคุณเองสำหรับแชท AI"
      >
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        </div>
      </SectionCard>
    );
  }

  const status = DEFAULT_LABELS[settings.source];
  const configured = settings.has_key;

  return (
    <SectionCard
      icon={<Sparkles size={19} aria-hidden="true" />}
      iconBg="bg-violet-50 dark:bg-violet-950/30"
      iconColor="text-violet-600 dark:text-violet-400"
      iconRing="ring-violet-200/60 dark:ring-violet-800/40"
      title="เชื่อมต่อ AI Chat (API Key)"
      subtitle="เลือกผู้ให้บริการและใส่คีย์ของคุณเอง — ใช้เฉพาะบัญชีนี้"
      badge="Bring your own key"
    >
      <div className="space-y-5">
        {/* Current connection */}
        <div className="flex flex-col gap-2 rounded-apple-widget border border-[var(--hairline)] bg-[var(--surface-subtle)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                configured || settings.source === 'server'
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--ink-tertiary)]'
              }`}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--ink)]">{status.title}</p>
              <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">{status.body}</p>
            </div>
          </div>
          {configured && (
            <div className="flex shrink-0 items-center gap-1.5 self-start rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)] sm:self-auto">
              <KeyRound size={12} aria-hidden="true" />
              <span>
                {settings.provider === 'gemini' ? 'Gemini' : 'OpenAI-compatible'}
                {settings.model ? ` · ${settings.model}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Provider + key */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 ml-1 block text-[12px] font-bold text-[var(--ink-secondary)]">
              ผู้ให้บริการ
            </label>
            <Select
              value={settings.provider}
              onChange={(value) => {
                setSettings((prev) => ({ ...prev, provider: value as AIProviderName }));
                // Models are provider-specific, so a leftover name would be
                // sent to the new provider and rejected there.
                setModel('');
                if (value === 'gemini') setBaseUrl('');
              }}
              options={PROVIDER_OPTIONS}
              ariaLabel="เลือกผู้ให้บริการ AI"
              size="md"
              className="w-full"
            />
          </div>

          <InsetField
            label="API Key"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder={configured ? 'บันทึกไว้แล้ว — เว้นว่างเพื่อใช้คีย์เดิม' : 'วาง API Key ของคุณ'}
            icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
            hint={configured ? 'เปลี่ยนเมื่อต้องการ' : 'จำเป็น'}
            autoComplete="off"
          />
        </div>

        {settings.provider === 'openai' && (
          <InsetField
            label="Base URL"
            type="url"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://api.openai.com/v1"
            icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            hint="ต้องเป็น https"
          />
        )}

        <InsetField
          label="Model"
          value={model}
          onChange={setModel}
          placeholder={
            settings.provider === 'gemini'
              ? 'gemini-3.5-flash'
              : 'เช่น glm-4-flash, gpt-4.1-mini'
          }
          icon={<Cpu className="h-4 w-4" aria-hidden="true" />}
          hint="เว้นว่างเพื่อใช้ค่าเริ่มต้น"
        />

        <div className="rounded-apple-widget border border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-3.5 py-3">
          <p className="text-[11px] leading-relaxed text-[var(--ink-tertiary)]">
            คีย์ถูกเข้ารหัสก่อนจัดเก็บและไม่ถูกส่งกลับมาแสดงผลอีก · ผู้ให้บริการที่ตั้งค่าไว้จะถูกใช้กับแชท
            AI ของบัญชีนี้เท่านั้น
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (!configured && !apiKey.trim())}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95] disabled:opacity-40"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              <span>{isSaving ? 'กำลังบันทึก…' : 'บันทึกการเชื่อมต่อ'}</span>
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !configured}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-secondary)] transition-colors duration-150 hover:bg-[var(--surface-grouped)] active:scale-[0.95] disabled:opacity-40"
            >
              {isTesting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <PlugZap size={14} aria-hidden="true" />
              )}
              <span>{isTesting ? 'กำลังทดสอบ…' : 'ทดสอบการเชื่อมต่อ'}</span>
            </button>
          </div>

          {configured && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-full px-3 py-2 text-[12px] font-semibold text-[var(--ink-muted)] transition-colors duration-150 hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95] sm:self-auto"
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>ลบการเชื่อมต่อ</span>
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
