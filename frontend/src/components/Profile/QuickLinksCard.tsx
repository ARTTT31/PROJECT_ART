'use client';

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react';
import { SectionCard } from './SectionCard';
import {
  QUICK_LINK_ICON_MAP,
  describeQuickLink,
  isExternalUrl,
  type QuickLink,
} from '@/utils/quickLinks';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface QuickLinksCardProps {
  links: QuickLink[];
  onAdd: () => void;
  onEdit: (link: QuickLink) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

/** "ควิกลิ้งค์ (Quick Links)" card: the sidebar shortcuts this user configured. */
export function QuickLinksCard({ links, onAdd, onEdit, onDelete, onMove }: QuickLinksCardProps) {
  const { t } = useI18n();

  return (
    <SectionCard
      icon={<Link2 size={19} aria-hidden="true" />}
      iconBg="bg-sky-50"
      iconColor="text-sky-600"
      iconRing="ring-sky-200/60"
      title={t('card.quickLinks.title')}
      subtitle={t('card.quickLinks.subtitle')}
      action={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95"
        >
          <Plus size={13} aria-hidden="true" />
          {t('card.quickLinks.add')}
        </button>
      }
    >
      {links.length === 0 ? (
        <div className="rounded-apple-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-apple-lg bg-[var(--surface)] text-sky-600 shadow-xs ring-1 ring-[var(--hairline)]">
            <Link2 size={20} aria-hidden="true" />
          </div>
          <h3 className="text-[14px] font-bold text-[var(--ink)]">
            {t('card.quickLinks.empty.title')}
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-[12px] text-[var(--ink-muted)] leading-relaxed">
            {t('card.quickLinks.empty.body')}
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)]"
          >
            <Plus size={13} aria-hidden="true" />
            {t('card.quickLinks.empty.cta')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link, index) => {
            const Icon = QUICK_LINK_ICON_MAP[link.icon] || Link2;
            const linkMeta = describeQuickLink(link.url);
            const external = isExternalUrl(link.url);
            return (
              <div
                key={link.id}
                className="group flex items-center gap-3 rounded-apple-lg bg-[var(--surface)] p-2.5 sm:p-3 ring-1 ring-[var(--hairline)] transition-all hover:bg-[var(--surface-subtle)] shadow-2xs"
              >
                <div className="shrink-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-apple-widget shadow-2xs ring-1 ring-[var(--hairline)]"
                    style={{ backgroundColor: `${link.color || 'var(--accent)'}15` }}
                  >
                    <Icon size={17} aria-hidden="true" style={{ color: link.color || 'var(--accent)' }} />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate text-[13px] font-bold tracking-tight text-[var(--ink)]">
                      {link.label}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[11px] font-bold ring-1 ${
                        external
                          ? 'bg-sky-50 text-sky-700 ring-sky-200'
                          : 'bg-violet-50 text-violet-700 ring-violet-200'
                      }`}
                    >
                      {linkMeta.tone}
                    </span>
                    {link.envs && Object.keys(link.envs).length > 0 && (
                      <span className="rounded-full bg-[var(--surface-grouped-2)] px-1.5 py-[1px] text-[11px] font-bold text-[var(--ink-muted)] ring-1 ring-[var(--hairline)]">
                        +{Object.keys(link.envs).length} env
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">{link.url}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMove(link.id, 'up')}
                    disabled={index === 0}
                    aria-label="ย้ายขึ้น"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(link.id, 'down')}
                    disabled={index === links.length - 1}
                    aria-label="ย้ายลง"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  <a
                    href={link.url}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    className="flex h-7 items-center justify-center sm:gap-1 rounded-apple-md px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                    aria-label={`เปิดลิงก์ ${link.label}`}
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                    <span className="hidden sm:inline">เปิด</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onEdit(link)}
                    className="inline-flex h-7 items-center gap-1 rounded-apple-md px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                    aria-label="แก้ไขลิงก์"
                  >
                    <PencilLine size={12} aria-hidden="true" />
                    <span className="hidden sm:inline">แก้ไข</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(link.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-apple-md px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                    aria-label="ลบลิงก์"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    <span className="hidden sm:inline">ลบ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default QuickLinksCard;
