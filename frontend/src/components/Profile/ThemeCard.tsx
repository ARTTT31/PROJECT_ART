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
          aria-label="กลับไปใช้ค่าเริ่มต้น"
          title="กลับไปใช้ค่าเริ่มต้น"
          className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-full bg-[var(--surface)] text-[12px] font-bold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-grouped)] active:scale-[0.95] sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span className="hidden sm:inline">ค่าเริ่มต้น</span>
        </button>
      }
    >
      <div className="space-y-3">
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
          <SegmentedControl
            label="โหมดการแสดงผล"
            fullWidth
            value={mode}
            onChange={setMode}
            options={THEME_MODES.map((option) => ({
              value: option.id,
              label: option.label,
              // A phone's segment is ~85px wide; the icon alone takes a fifth of
              // that, so "ตามระบบ" was truncated to "ตามร…".
              icon: <span className="hidden sm:inline-flex">{MODE_ICON[option.id]}</span>,
            }))}
          />
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
          {/* Name chips rather than bare dots: the colour reads from the bar, the
              name removes the guessing, and a chip shows its selected state with
              a ring instead of growing the whole control. */}
          <div
            role="radiogroup"
            aria-label="สีหลัก"
            className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6"
          >
            {THEME_ACCENTS.map((option) => {
              const selected = accent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`ใช้สี ${option.label}`}
                  title={option.label}
                  id={`theme-accent-${option.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setAccent(option.id)}
                  onKeyDown={(event) => {
                    const ids = THEME_ACCENTS.map((entry) => entry.id);
                    const current = ids.indexOf(accent);
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
                    setAccent(ids[next]);
                    document.getElementById(`theme-accent-${ids[next]}`)?.focus();
                  }}
                  className={`flex min-w-0 items-center gap-2 rounded-apple-md px-2 py-2 text-left transition-all duration-apple-1 active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    selected
                      ? 'bg-[var(--accent-soft-weak)] ring-[1.5px] ring-[var(--accent)]'
                      : 'bg-[var(--surface)] ring-1 ring-[var(--hairline)] hover:ring-[var(--hairline-strong)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: option.color }}
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] ring-1 ring-[var(--swatch-edge)]"
                  >
                    {selected && (
                      <Check size={12} className="text-white" strokeWidth={3} />
                    )}
                  </span>
                  <span
                    className={`min-w-0 truncate text-[12px] font-semibold ${
                      selected ? 'text-[var(--ink)]' : 'text-[var(--ink-secondary)]'
                    }`}
                  >
                    {option.label}
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

export default ThemeCard;
