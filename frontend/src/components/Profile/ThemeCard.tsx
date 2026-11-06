'use client';

import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { SectionCard } from './SectionCard';
import SegmentedControl from '@/components/ui/SegmentedControl';
import {
  THEME_ACCENTS,
  THEME_MODES,
  useTheme,
  type ThemeMode,
} from '@/context/ThemeContext';
import { showToast } from '@/utils/sweetalert';
import { useI18n } from '@/lib/i18n/I18nProvider';

const MODE_ICON: Record<ThemeMode, React.ReactNode> = {
  system: <Monitor size={16} aria-hidden="true" />,
  light: <Sun size={16} aria-hidden="true" />,
  dark: <Moon size={16} aria-hidden="true" />,
};

/**
 * Theme card: appearance (light / dark / follow the OS) and the accent colour
 * used by buttons, links, focus rings and selected states.
 *
 * The choice is stored per browser on purpose — it is a display preference, so
 * a shared account on a second device should not inherit this screen's dark mode.
 */
export function ThemeCard() {
  const { t } = useI18n();
  const { mode, accent, resolvedMode, setMode, setAccent, resetTheme } = useTheme();

  const handleReset = () => {
    resetTheme();
    showToast('กลับไปใช้ธีมเริ่มต้นแล้ว', 'success');
  };

  return (
    <SectionCard
      icon={<Palette size={19} aria-hidden="true" />}
      iconBg="bg-[var(--accent-soft)]"
      iconColor="text-[var(--accent-text)]"
      iconRing="ring-[var(--accent-ring)]"
      title={t('card.theme.title')}
      subtitle={t('card.theme.subtitle')}
      action={
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-grouped)] active:scale-95"
        >
          <RotateCcw size={12} aria-hidden="true" />
          ค่าเริ่มต้น
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
            โหมดการแสดงผล
          </span>
          <SegmentedControl
            label="โหมดการแสดงผล"
            fullWidth
            value={mode}
            onChange={setMode}
            options={THEME_MODES.map((option) => ({
              value: option.id,
              label: option.label,
              icon: MODE_ICON[option.id],
            }))}
          />
          <p className="mt-2 text-[12px] text-[var(--ink-tertiary)]">
            {mode === 'system'
              ? `ตอนนี้ระบบของคุณใช้โหมด${resolvedMode === 'dark' ? 'มืด' : 'สว่าง'}`
              : `กำลังใช้โหมด${mode === 'dark' ? 'มืด' : 'สว่าง'}อยู่`}
          </p>
        </div>

        <div>
          <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
            สีหลัก (Accent)
          </span>
          <div className="flex flex-wrap gap-2.5">
            {THEME_ACCENTS.map((option) => {
              const selected = accent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.id)}
                  title={option.label}
                  aria-label={`ใช้สี${option.label}`}
                  aria-pressed={selected}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] ${
                    selected
                      ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]'
                      : 'ring-1 ring-[var(--hairline)] hover:ring-[var(--hairline-strong)]'
                  }`}
                  style={{ backgroundColor: option.color }}
                >
                  {selected && (
                    <Check size={17} className="text-white" aria-hidden="true" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="rounded-[14px] bg-[var(--surface-grouped)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
          การตั้งค่านี้ถูกจำไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่กระทบผู้ใช้คนอื่นใน workspace
        </p>
      </div>
    </SectionCard>
  );
}

export default ThemeCard;
