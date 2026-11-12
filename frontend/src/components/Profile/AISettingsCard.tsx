'use client';

import { useCallback, useEffect, useState } from 'react';
import { SiGooglegemini } from '@icons-pack/react-simple-icons';
import {
  Check,
  Cpu,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { showConfirm, showError, showSuccess } from '@/utils/sweetalert';
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

const GEMINI_PRESETS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tag: 'แนะนำ' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tag: 'ฉลาดสุด' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

const OPENAI_PRESETS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tag: 'ประหยัด' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
];

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
  const presets = settings.provider === 'gemini' ? GEMINI_PRESETS : OPENAI_PRESETS;

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
        {/* Current connection banner */}
        <div className="flex flex-col gap-3 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                configured
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : settings.source === 'server'
                    ? 'bg-blue-500'
                    : 'bg-stone-400'
              }`}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[var(--ink)]">{status.title}</p>
              <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">{status.body}</p>
            </div>
          </div>
          {configured && (
            <div className="flex shrink-0 items-center gap-1.5 self-start rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--hairline)] sm:self-auto shadow-2xs">
              <KeyRound size={12} className="text-[var(--accent)]" aria-hidden="true" />
              <span>
                {settings.provider === 'gemini' ? 'Gemini' : 'OpenAI-compatible'}
                {settings.model ? ` · ${settings.model}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Visual Provider Cards */}
        <div className="space-y-2">
          <label className="block text-[12px] font-bold text-[var(--ink-secondary)]">
            เลือกผู้ให้บริการ AI
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="เลือกผู้ให้บริการ AI">
            {/* Gemini */}
            <button
              type="button"
              role="radio"
              aria-checked={settings.provider === 'gemini'}
              onClick={() => {
                setSettings((prev) => ({ ...prev, provider: 'gemini' }));
                setModel('');
                setBaseUrl('');
              }}
              className={`flex items-start gap-3 p-3.5 rounded-apple-lg border text-left transition-all duration-150 active:scale-[0.98] ${
                settings.provider === 'gemini'
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/25 ring-2 ring-[var(--accent)] shadow-xs'
                  : 'border-[var(--hairline)] bg-[var(--surface)] hover:bg-[var(--surface-grouped)]'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <SiGooglegemini size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[var(--ink)]">Google Gemini</span>
                  {settings.provider === 'gemini' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                      <Check size={11} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                  แนะนำ · รองรับฟรีคีย์และตอบสนองรวดเร็ว
                </p>
              </div>
            </button>

            {/* OpenAI */}
            <button
              type="button"
              role="radio"
              aria-checked={settings.provider === 'openai'}
              onClick={() => {
                setSettings((prev) => ({ ...prev, provider: 'openai' }));
                setModel('');
              }}
              className={`flex items-start gap-3 p-3.5 rounded-apple-lg border text-left transition-all duration-150 active:scale-[0.98] ${
                settings.provider === 'openai'
                  ? 'border-[var(--accent)] bg-[var(--accent-tint)]/25 ring-2 ring-[var(--accent)] shadow-xs'
                  : 'border-[var(--hairline)] bg-[var(--surface)] hover:bg-[var(--surface-grouped)]'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Cpu size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[var(--ink)]">OpenAI-Compatible</span>
                  {settings.provider === 'openai' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                      <Check size={11} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                  OpenAI, OpenRouter, Groq, Z.ai
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Free API Key Banner for Gemini */}
        {settings.provider === 'gemini' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-apple-md bg-blue-50/70 dark:bg-blue-950/20 px-3.5 py-2.5 border border-blue-200/60 dark:border-blue-900/40 text-[11px]">
            <span className="text-blue-800 dark:text-blue-200 font-medium">
              💡 ยังไม่มี API Key? สามารถรับฟรีได้จาก Google AI Studio
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              <span>ขอรับ API Key ฟรี</span>
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
        )}

        {/* API Key Input */}
        <InsetField
          label="API Key"
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder={configured ? 'บันทึกไว้แล้ว — เว้นว่างเพื่อใช้คีย์เดิม' : 'วาง API Key ของคุณที่นี่'}
          icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
          hint={configured ? 'ใส่เฉพาะเมื่อต้องการเปลี่ยน' : 'จำเป็นต้องระบุ'}
          autoComplete="off"
        />

        {/* Base URL (OpenAI only) */}
        {settings.provider === 'openai' && (
          <InsetField
            label="Base URL"
            type="url"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://api.openai.com/v1"
            icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            hint="เว้นว่างไว้เพื่อใช้ค่าเริ่มต้นของ OpenAI"
          />
        )}

        {/* Model Presets & Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="model-input" className="block text-[12px] font-bold text-[var(--ink-secondary)]">
              Model (โมเดล)
            </label>
            <span className="text-[11px] text-[var(--ink-muted)]">คลิกเลือกโมเดลยอดนิยม</span>
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {presets.map((preset) => {
              const active = model === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setModel(preset.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all active:scale-[0.96] ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-2xs'
                      : 'bg-[var(--surface-grouped)] text-[var(--ink-secondary)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] ring-1 ring-[var(--hairline)]'
                  }`}
                >
                  <span>{preset.label}</span>
                  {preset.tag && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--accent-tint)] text-[var(--accent-text)]'
                      }`}
                    >
                      {preset.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <InsetField
            id="model-input"
            label="หรือระบุชื่อโมเดลเอง"
            value={model}
            onChange={setModel}
            placeholder={
              settings.provider === 'gemini'
                ? 'gemini-2.5-flash'
                : 'เช่น gpt-4o, claude-3-5-sonnet, glm-4-flash'
            }
            icon={<Cpu className="h-4 w-4" aria-hidden="true" />}
            hint="เว้นว่างเพื่อใช้ค่าเริ่มต้นของระบบ"
          />
        </div>

        <div className="rounded-apple-widget border border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-[var(--ink-tertiary)]">
            🔒 คีย์ของคุณจะถูกเข้ารหัสก่อนบันทึกลงฐานข้อมูล และถูกใช้งานเฉพาะการสนทนาของบัญชีคุณเท่านั้น
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--hairline-soft)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (!configured && !apiKey.trim())}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95] disabled:opacity-40 shadow-2xs"
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
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-full px-3 py-2 text-[12px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150 active:scale-[0.95] sm:self-auto"
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
