'use client';

import Link from 'next/link';
import { ExternalLink, Link2, Plus } from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { useAuth } from '@/hooks/useAuth';
import { describeQuickLink, isExternalUrl, parseQuickLinks, QUICK_LINK_ICON_MAP } from '@/utils/quickLinks';

/**
 * Shortcut board for the links an account saved on its profile page.
 *
 * The list itself is not duplicated here: it is the same `user.quick_links`
 * JSON the sidebar renders, so adding a link in one place updates both.
 */
export default function QuickLinksWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const { user } = useAuth();
  const links = parseQuickLinks(user?.quick_links);

  return (
    <section
      className="flex h-full flex-col rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-labelledby="quick-links-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#0066cc]/10 text-[#0066cc]">
            <Link2 size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="quick-links-title" className="truncate text-[16px] font-bold tracking-tight text-[#1d1d1f]">
              ลิงก์ด่วน
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[#86868b]">
              {links.length > 0 ? `${links.length} ลิงก์ที่บันทึกไว้` : 'ทางลัดไปยังเว็บที่ใช้บ่อย'}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      {links.length === 0 ? (
        <div className="mt-4 flex min-h-[120px] flex-1 flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] bg-[#f8f8fa] px-4 text-center">
          <Link2 size={20} className="mb-2 text-[#a1a1a6]" aria-hidden="true" />
          <p className="text-[12.5px] text-[#86868b]">ยังไม่มีลิงก์ด่วน</p>
          <Link
            href="/profile"
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0066cc] shadow-xs ring-1 ring-black/[0.06] transition-colors hover:bg-[#f2f2f7]"
          >
            <Plus size={13} aria-hidden="true" /> เพิ่มในหน้าโปรไฟล์
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-0.5">
          {links.map((link) => {
            const Icon = QUICK_LINK_ICON_MAP[link.icon] ?? Link2;
            const external = isExternalUrl(link.url);
            const description = describeQuickLink(link.url);
            const Tag = external ? 'a' : Link;

            return (
              <li key={link.id}>
                <Tag
                  href={link.url}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  title={`${link.label} — ${description.title}`}
                  className="group flex h-full items-center gap-2.5 rounded-[12px] bg-[#f5f5f7] px-3 py-2.5 transition-colors hover:bg-[#e9e9ee] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#1d1d1f] shadow-2xs"
                    style={link.color ? { color: link.color } : undefined}
                  >
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#1d1d1f]">
                    {link.label}
                  </span>
                  {external && (
                    <ExternalLink
                      size={12}
                      aria-hidden="true"
                      className="shrink-0 text-[#a1a1a6] opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  )}
                </Tag>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
