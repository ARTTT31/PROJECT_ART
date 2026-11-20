'use client';

import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { SectionCard } from './SectionCard';
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
          aria-label="กลับไปใช้ค่าเริ่มต้น"
          title="กลับไปใช้ค่าเริ่มต้น"
          className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-full bg-[var(--surface)] text-[12px] font-bold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span className="hidden sm:inline">ค่าเริ่มต้น</span>
        </button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Appearance */}
        <div className="rounded-apple-lg bg-[var(--surface-grouped)] p-3 ring-1 ring-[var(--hairline)] sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--ink-secondary)]">
              โหมดการแสดงผล
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)]">
              {MODE_ICON[mode]}
              <span className="tabular-nums">{modeSummary}</span>
            </span>
          </div>
          {/* Tiles instead of a segmented pill: three words in a pill had to
              share ~85px each on a phone, while a tile can put the icon above
              the label and read at a glance. */}
          <div
            role="radiogroup"
            aria-label="โหมดการแสดงผล"
            onKeyDown={(event) => {
              const ids = THEME_MODES.map((option) => option.id);
              const current = ids.indexOf(mode);
              if (current === -1) return;
              let next = current;
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                next = (current + 1) % ids.length;
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                next = (current - 1 + ids.length) % ids.length;
              } else if (event.key === 'Home') {
                next = 0;
              } else if (event.key === 'End') {
                next = ids.length - 1;
              } else {
                return;
              }
              event.preventDefault();
              setMode(ids[next]);
              document.getElementById(`theme-mode-${ids[next]}`)?.focus();
            }}
            className="grid grid-cols-3 gap-2"
          >
            {THEME_MODES.map((option) => {
              const selected = option.id === mode;
              return (
                <button
                  key={option.id}
                  id={`theme-mode-${option.id}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setMode(option.id)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-apple-md px-1.5 py-2.5 ring-1 transition-all duration-150 active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    selected
                      ? 'bg-[var(--surface)] text-[var(--accent-text)] ring-[var(--accent-border)]'
                      : 'bg-[var(--surface-grouped-2)] text-[var(--ink-muted)] ring-transparent hover:bg-[var(--surface)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-apple-sm ${
                      selected ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface)] ring-1 ring-[var(--hairline)]'
                    }`}
                  >
                    {MODE_ICON[option.id]}
                  </span>
                  <span className="text-[11.5px] font-bold">{option.label}</span>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" aria-hidden="true">
                      <Check size={10} strokeWidth={3.5} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent */}
        <div className="rounded-apple-lg bg-[var(--surface-grouped)] p-3 ring-1 ring-[var(--hairline)] sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--ink-secondary)]">
              สีหลัก (Accent)
            </span>
            <span className="truncate text-[11px] font-semibold text-[var(--ink-muted)]">
              {activeAccent?.label ?? '—'}
            </span>
          </div>
          {/* Even columns keep the last swatch on the same line as the rest
              instead of leaving one lonely circle on a second row. */}
          <div className="grid grid-cols-8 gap-2">

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
                  className={`relative flex aspect-square w-full max-w-10 items-center justify-center rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.14)] transition-all duration-apple-2 hover:scale-105 active:scale-[0.95] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-grouped)] ${
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

          {/* The swatch alone does not show what the colour is for; this rows
              renders the accent the way the rest of the app uses it. */}
          <div className="mt-3 flex items-center gap-2 rounded-apple-md bg-[var(--surface)] px-2.5 py-2 ring-1 ring-[var(--hairline)]">
            <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-bold text-white">
              ปุ่มหลัก
            </span>
            <span className="text-[11px] font-bold text-[var(--accent-text)] underline underline-offset-2">
              ลิงก์
            </span>
            <span
              className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]"
              aria-hidden="true"
            >
              <Check size={11} strokeWidth={3} className="text-white" />
            </span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default ThemeCard;
