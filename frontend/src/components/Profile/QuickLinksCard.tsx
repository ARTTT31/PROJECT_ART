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
      iconBg="bg-[var(--info-soft)]"
      iconColor="text-[var(--info-ink)]"
      iconRing="ring-[var(--info-soft)]"
      title={t('card.quickLinks.title')}
      subtitle={t('card.quickLinks.subtitle')}
      action={
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('card.quickLinks.add')}
          className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[12px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95 sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5"
        >
          <Plus size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{t('card.quickLinks.add')}</span>
        </button>
      }
    >
      {links.length === 0 ? (
        <div className="rounded-apple-lg border border-dashed border-[var(--hairline)] bg-[var(--surface-grouped)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-apple-lg bg-[var(--surface)] text-[var(--info-ink)] shadow-xs ring-1 ring-[var(--hairline)]">
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
                          ? 'bg-[var(--info-soft)] text-[var(--info-ink)] ring-[var(--hairline)]'
                          : 'bg-[var(--accent-soft)] text-[var(--accent-text)] ring-[var(--hairline)]'
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

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onMove(link.id, 'up')}
                    disabled={index === 0}
                    aria-label={`ย้าย ${link.label} ขึ้น`}
                    title="ย้ายขึ้น"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(link.id, 'down')}
                    disabled={index === links.length - 1}
                    aria-label={`ย้าย ${link.label} ลง`}
                    title="ย้ายลง"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  <a
                    href={link.url}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    aria-label={`เปิดลิงก์ ${link.label}`}
                    title="เปิดลิงก์"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onEdit(link)}
                    aria-label={`แก้ไข ${link.label}`}
                    title="แก้ไข"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]"
                  >
                    <PencilLine size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(link.id)}
                    aria-label={`ลบ ${link.label}`}
                    title="ลบ"
                    className="flex h-7 w-7 items-center justify-center rounded-apple-md text-[var(--danger-ink)] transition-colors hover:bg-[var(--danger-soft)]"
                  >
                    <Trash2 size={13} aria-hidden="true" />
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
