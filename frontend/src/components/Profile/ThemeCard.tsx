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
 * That is why the card says nothing about it: the labels below describe what the
 * controls do, and a footer explaining storage scope only competed with them.
 */
export function ThemeCard() {
  const { t } = useI18n();
  const { mode, accent, resolvedMode, setMode, setAccent, resetTheme } = useTheme();

  const handleReset = () => {
    resetTheme();
    showToast('กลับไปใช้ธีมเริ่มต้นแล้ว', 'success');
  };

  const activeAccent = THEME_ACCENTS.find((option) => option.id === accent);
  const modeSummary =
    mode === 'system'
      ? `ตามระบบ · ${resolvedMode === 'dark' ? 'มืด' : 'สว่าง'}`
      : mode === 'dark'
        ? 'มืด'
        : 'สว่าง';

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
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95]"
        >
          <RotateCcw size={12} aria-hidden="true" />
          ค่าเริ่มต้น
        </button>
      }
    >
      <div className="space-y-3">
        {/* Appearance */}
        <div className="rounded-apple-lg bg-[var(--surface-grouped)] p-4 ring-1 ring-[var(--hairline)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--ink-secondary)]">
              โหมดการแสดงผล
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)]">
              {MODE_ICON[mode]}
              <span className="tabular-nums">{modeSummary}</span>
            </span>
          </div>
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
        </div>

        {/* Accent */}
        <div className="rounded-apple-lg bg-[var(--surface-grouped)] p-4 ring-1 ring-[var(--hairline)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--ink-secondary)]">
              สีหลัก (Accent)
            </span>
            <span className="truncate text-[11px] font-semibold text-[var(--ink-muted)]">
              {activeAccent?.label ?? '—'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {THEME_ACCENTS.map((option) => {
              const selected = accent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.id)}
                  title={option.label}
                  aria-label={`ใช้สี ${option.label}`}
                  aria-pressed={selected}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-apple-2 active:scale-[0.95] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-grouped)] ${
                    selected
                      ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface-grouped)]'
                      : 'ring-1 ring-[var(--hairline)] hover:ring-[var(--hairline-strong)]'
                  }`}
                  style={{ backgroundColor: option.color }}
                >
                  {selected && (
                    <Check
                      size={16}
                      className="text-[var(--surface)]"
                      aria-hidden="true"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default ThemeCard;
