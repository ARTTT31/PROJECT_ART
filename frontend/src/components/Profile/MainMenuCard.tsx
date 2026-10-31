'use client';

import { ChevronDown, ChevronUp, LayoutGrid, Sparkles } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { MAIN_MENU_ICON_MAP, type MainMenuItemConfig } from '@/utils/mainMenu';

interface MainMenuCardProps {
  items: MainMenuItemConfig[];
  onToggle: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

/**
 * "เมนูหลักของระบบ" card: shows the pages this user can reach, with a toggle to
 * hide/show each one and arrows to reorder the sidebar.
 */
export function MainMenuCard({ items, onToggle, onMove }: MainMenuCardProps) {
  return (
    <SectionCard
      icon={<LayoutGrid size={19} aria-hidden="true" />}
      iconBg="bg-violet-50"
      iconColor="text-violet-600"
      iconRing="ring-violet-200/60"
      title="เมนูหลักของระบบ"
      subtitle="เปิด/ปิด และจัดลำดับรายการในแถบเมนูด้านข้าง"
    >
      <div className="space-y-2">
        {items.map((item, idx, arr) => {
          const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-all duration-150 ${
                item.enabled
                  ? 'bg-[var(--surface)] ring-[var(--hairline)] shadow-2xs'
                  : 'bg-[var(--surface-grouped)] ring-transparent opacity-60'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                  item.enabled ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-slate-200 text-slate-400'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-bold tracking-tight text-[var(--ink)]">
                    {item.name}
                  </span>
                  {item.required && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-[1px] text-[9.5px] font-bold text-slate-500 ring-1 ring-slate-200">
                      บังคับ
                    </span>
                  )}
                </div>
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

                {/* iOS Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  aria-label={`${item.enabled ? 'ซ่อน' : 'แสดง'} ${item.name}`}
                  disabled={!!item.required}
                  onClick={() => onToggle(item.id)}
                  style={{
                    width: '44px',
                    height: '28px',
                    minWidth: '44px',
                    minHeight: '28px',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                  }}
                  className={`relative ml-1 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed ${
                    item.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-chip)]'
                  } ${item.required ? 'opacity-70' : ''}`}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      transform: item.enabled ? 'translateX(16px)' : 'translateX(0px)',
                    }}
                    className="pointer-events-none inline-block rounded-full bg-[var(--surface)] shadow-[0_2px_4px_rgba(0,0,0,0.15),0_0_1px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-in-out"
                  />
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
