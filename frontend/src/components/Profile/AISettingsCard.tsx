'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Human name of the service behind the saved settings, e.g. "OpenRouter". */
  provider_label?: string;
  /** The model the next reply will use, even when `model` is empty. */
  effective_model?: string;
}

/** What the backend recognised when the key was pasted. */
interface KeyDetection {
  label: string;
  provider: AIProviderName;
  baseUrl: string;
  models: string[];
  model: string;
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

export default function AISettingsCard() {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'gemini',
    has_key: false,
    base_url: '',
    model: '',
    source: 'none',
  });
  const [apiKey, setApiKey] = useState('');
  const [detection, setDetection] = useState<KeyDetection | null>(null);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      provider_label: data.provider_label,
      effective_model: data.effective_model,
    });
    setBaseUrl(data.base_url || '');
    setModel(data.model || '');
  }, []);

  // The chat reads its subtitle from the same event, so a saved key changes what
  // the drawer says about itself without a reload.
  const announceSettingsChange = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ai-settings-changed'));
    }
  };

  /**
   * Read the provider off a pasted key instead of making the user pick one.
   * A key like `sk-or-v1-…` already says OpenRouter; the backend also asks that
   * service which models the key can use, so the model list is real.
   */
  const detectKey = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 8) {
      setDetection(null);
      setDetectNote(null);
      return;
    }

    setIsDetecting(true);
    try {
      const res = await fetchWithAuth('/api/v1/ai/settings/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetection(null);
        setDetectNote(apiMessage(body, 'ตรวจไม่พบผู้ให้บริการจากคีย์นี้ — เลือกเองได้เลย'));
        return;
      }

      const data = body.data || {};
      const provider: AIProviderName = data.provider === 'openai' ? 'openai' : 'gemini';
      setDetection({
        label: data.label || 'ตรวจพบผู้ให้บริการ',
        provider,
        baseUrl: data.base_url || '',
        models: Array.isArray(data.models) ? data.models : [],
        model: data.model || '',
      });
      setDetectNote(null);

      // Fill the whole form: provider, base URL and the suggested model.
      setSettings((prev) => ({ ...prev, provider }));
      setBaseUrl(data.base_url || '');
      if (data.model) setModel(data.model);
    } catch (err) {
      console.error('Detect AI key error:', err);
      setDetection(null);
      setDetectNote('ตรวจคีย์ไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง');
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => {
      void detectKey(value);
    }, 600);
  };

  useEffect(
    () => () => {
      if (detectTimer.current) clearTimeout(detectTimer.current);
    },
    [],
  );

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
        setDetection(null);
        setDetectNote(null);
        announceSettingsChange();
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
        announceSettingsChange();
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
        iconBg="bg-[var(--info-soft)]"
        iconColor="text-[var(--info-ink)]"
        iconRing="ring-[var(--hairline-strong)]"
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
  const connectionLabel =
    settings.provider_label || (settings.provider === 'gemini' ? 'Gemini' : 'OpenAI-compatible');
  const connectionModel = settings.effective_model || settings.model;

  return (
    <SectionCard
      icon={<Sparkles size={19} aria-hidden="true" />}
      iconBg="bg-[var(--info-soft)]"
      iconColor="text-[var(--info-ink)]"
      iconRing="ring-[var(--hairline-strong)]"
      title="เชื่อมต่อ AI Chat (API Key)"
      subtitle="เลือกผู้ให้บริการและใส่คีย์ของคุณเอง — ใช้เฉพาะบัญชีนี้"
    >
      <div className="space-y-5">
        {/* Current connection banner */}
        <div className="flex flex-col gap-3 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                configured
                  ? 'bg-[var(--success)] shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : settings.source === 'server'
                    ? 'bg-[var(--info-ink)]'
                    : 'bg-[var(--ink-faint)]'
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
                {connectionLabel}
                {connectionModel ? ` · ${connectionModel}` : ''}
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)]">
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-md bg-[var(--success-soft)] text-[var(--success-ink)]">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-apple-md bg-[var(--accent-soft-weak)] px-3.5 py-2.5 border border-[var(--accent-border)] text-[11px]">
            <span className="text-[var(--accent-text)] font-medium">
              💡 ยังไม่มี API Key? สามารถรับฟรีได้จาก Google AI Studio
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-[var(--accent-text)] hover:underline shrink-0"
            >
              <span>ขอรับ API Key ฟรี</span>
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
        )}

        {/* API Key Input — pasting is enough, the provider is read from it */}
        <InsetField
          label="API Key"
          type="password"
          value={apiKey}
          onChange={handleKeyChange}
          placeholder={configured ? 'บันทึกไว้แล้ว — เว้นว่างเพื่อใช้คีย์เดิม' : 'วาง API Key ของคุณที่นี่'}
          icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
          hint={
            isDetecting
              ? 'กำลังตรวจคีย์…'
              : configured
                ? 'ใส่เฉพาะเมื่อต้องการเปลี่ยน'
                : 'วางคีย์ได้เลย — ระบบจะเลือกผู้ให้บริการและโมเดลให้'
          }
          autoComplete="off"
        />

        {(detection || detectNote) && (
          <div
            role="status"
            aria-live="polite"
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-apple-md px-3 py-2 text-[11px] ${
              detection
                ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
                : 'bg-[var(--warning-soft)] text-[var(--warning-ink)]'
            }`}
          >
            {detection ? (
              <>
                <span className="inline-flex items-center gap-1 font-bold">
                  <Check size={12} aria-hidden="true" />
                  ตรวจพบ: {detection.label}
                </span>
                {detection.models.length > 0 && (
                  <span className="opacity-80">· พบ {detection.models.length} โมเดลที่ใช้ได้</span>
                )}
                {detection.model && (
                  <span className="opacity-80">· แนะนำ {detection.model}</span>
                )}
              </>
            ) : (
              <span>{detectNote}</span>
            )}
          </div>
        )}

        {/* Model chips: the models this key can actually reach, from the live
            provider list, so choosing one is a click instead of typing an id. */}
        {detection && detection.models.length > 0 && (
          <div className="space-y-2">
            <label className="block text-[12px] font-bold text-[var(--ink-secondary)]">
              โมเดลที่คีย์นี้ใช้ได้
            </label>
            <div
              role="group"
              aria-label="เลือกโมเดลที่ใช้ได้"
              className="flex flex-wrap gap-1.5"
            >
              {detection.models.slice(0, 8).map((modelId) => {
                const active = model.trim() === modelId;
                const recommended = modelId === detection.model;
                return (
                  <button
                    key={modelId}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setModel(modelId)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 active:scale-[0.95] ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {active && <Check size={11} aria-hidden="true" />}
                    <span>{modelId}</span>
                    {recommended && (
                      <span className="opacity-70">· แนะนำ</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Model: detection fills the working model in, and this field is the
            manual override for anything the provider does not list. */}
        <InsetField
          id="model-input"
          label="โมเดล (ไม่บังคับ)"
          value={model}
          onChange={setModel}
          placeholder={
            settings.provider === 'gemini'
              ? 'gemini-3.8-flash'
              : 'เช่น gpt-4o, claude-3-5-sonnet, glm-4-flash'
          }
          icon={<Cpu className="h-4 w-4" aria-hidden="true" />}
          hint="เว้นว่างเพื่อใช้ค่าเริ่มต้นของระบบ"
        />

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
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-full px-3 py-2 text-[12px] font-semibold text-[var(--danger-ink)] hover:bg-[var(--danger-soft)] transition-colors duration-150 active:scale-[0.95] sm:self-auto"
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
