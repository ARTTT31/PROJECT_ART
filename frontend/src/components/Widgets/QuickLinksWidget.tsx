'use client';

import Link from 'next/link';
import { ArrowUpRight, ExternalLink, Link2, Plus } from 'lucide-react';
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#0a84ff]/15 to-[#0066cc]/10 text-[#0066cc]">
            <Link2 size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                id="quick-links-title"
                className="truncate text-[16px] font-bold tracking-tight text-[#1d1d1f]"
              >
                ลิงก์ด่วน
              </h3>
              {links.length > 0 && (
                <span className="shrink-0 rounded-full bg-[#0066cc]/10 px-1.5 py-px text-[10px] font-bold tabular-nums text-[#0066cc]">
                  {links.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[#86868b]">
              {links.length > 0 ? 'ทางลัดที่คุณบันทึกไว้' : 'ทางลัดไปยังเว็บที่ใช้บ่อย'}
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
      </div>

      {links.length === 0 ? (
        <div className="mt-4 flex min-h-[120px] flex-1 flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] bg-[#f8f8fa] px-4 text-center">
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#a1a1a6] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.04]">
            <Link2 size={17} aria-hidden="true" />
          </span>
          <p className="text-[12.5px] font-medium text-[#6e6e73]">ยังไม่มีลิงก์ด่วน</p>
          <p className="mt-0.5 text-[11px] text-[#a1a1a6]">เพิ่มเว็บที่คุณเปิดบ่อยไว้เป็นทางลัด</p>
          <Link
            href="/profile"
            className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#0066cc] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(0,102,204,0.5)] transition-all duration-150 hover:bg-[#0071e3] active:scale-95"
          >
            <Plus size={13} aria-hidden="true" /> เพิ่มในหน้าโปรไฟล์
          </Link>
        </div>
      ) : (
        <ul
          className={`mt-4 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-0.5 ${
            width >= 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
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
                  className="group flex h-full items-center gap-2.5 rounded-[13px] border border-black/[0.06] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 hover:-translate-y-px hover:border-[#0066cc]/25 hover:shadow-[0_8px_18px_-12px_rgba(0,0,0,0.45)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066cc]/40"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#f5f5f7] text-[#0066cc] ring-1 ring-black/[0.04] transition-colors duration-150 group-hover:bg-[#0066cc]/[0.08]"
                    style={link.color ? { color: link.color } : undefined}
                  >
                    <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold leading-tight text-[#1d1d1f]">
                      {link.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-[#a1a1a6]">
                      {description.title}
                    </span>
                  </span>
                  {external ? (
                    <ArrowUpRight
                      size={13}
                      aria-hidden="true"
                      className="shrink-0 -translate-x-0.5 text-[#c7c7cc] opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:text-[#0066cc] group-hover:opacity-100"
                    />
                  ) : (
                    <ExternalLink
                      size={12}
                      aria-hidden="true"
                      className="shrink-0 text-[#c7c7cc] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
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
