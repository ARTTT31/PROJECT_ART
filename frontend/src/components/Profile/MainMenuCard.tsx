'use client';

import { ChevronDown, ChevronUp, LayoutGrid, Sparkles } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { MAIN_MENU_ICON_MAP, type MainMenuItemConfig } from '@/utils/mainMenu';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface MainMenuCardProps {
  items: MainMenuItemConfig[];
  onMove: (id: string, direction: 'up' | 'down') => void;
}

/**
 * "เมนูหลักของระบบ" card: the pages this user can reach, with arrows to reorder
 * the sidebar. Whether a page is open for the whole workspace is decided in
 * /admin (the page-switch card), so there is no per-user toggle here.
 */
export function MainMenuCard({ items, onMove }: MainMenuCardProps) {
  const { t } = useI18n();

  return (
    <SectionCard
      icon={<LayoutGrid size={19} aria-hidden="true" />}
      iconBg="bg-violet-50"
      iconColor="text-violet-600"
      iconRing="ring-violet-200/60"
      title={t('card.mainMenu.title')}
      subtitle={t('card.mainMenu.subtitle')}
    >
      <div className="space-y-2">
        {items.map((item, idx, arr) => {
          const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-2xs transition-all duration-150"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Icon size={18} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[13.5px] font-bold tracking-tight text-[var(--ink)]">
                  {item.name}
                </span>
                {item.description && (
                  <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">{item.description}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(item.id, 'up')}
                  disabled={idx === 0}
                  aria-label="ย้ายขึ้น"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.id, 'down')}
                  disabled={idx === arr.length - 1}
                  aria-label="ย้ายลง"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export default MainMenuCard;
