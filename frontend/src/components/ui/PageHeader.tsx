'use client';

import { useEffect, useRef } from 'react';
import { setPageTitle, setPageTitleCollapsed } from '@/lib/pageTitleStore';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Leading squircle badge, e.g. <Bell size={20} />. Optional. */
  icon?: React.ReactNode;
  /** Trailing buttons; wrap on narrow screens. */
  actions?: React.ReactNode;
  /** Secondary row, e.g. a filter segmented control. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * One large title per page (Apple "large title"), plus the compact title in the
 * app header that fades in when this heading scrolls away.
 *
 * Use this instead of hand-rolling an <h1> so every page shares the same rank,
 * size and spacing — the app previously had four different page-title styles.
 */
/**
 * Registers a page's large heading with the app header and returns the ref it
 * must be attached to. Exported for pages whose heading already lives inside a
 * hero card (dashboard, profile) and should not be restyled by PageHeader.
 */
export function usePageHeading(title: string) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setPageTitle(title);
    const heading = headingRef.current;
    if (!heading || typeof IntersectionObserver === 'undefined') {
      return () => setPageTitle(null);
    }
    // The header bar is 52px tall; the large title counts as hidden once it
    // slides underneath it.
    const observer = new IntersectionObserver(
      ([entry]) => setPageTitleCollapsed(!entry.isIntersecting),
      { rootMargin: '-56px 0px 0px 0px' },
    );
    observer.observe(heading);
    return () => {
      observer.disconnect();
      setPageTitle(null);
    };
  }, [title]);

  return headingRef;
}

export function PageHeader({ title, subtitle, icon, actions, children, className }: PageHeaderProps) {
  const headingRef = usePageHeading(title);

  return (
    <header className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1
              ref={headingRef}
              className="truncate text-apple-title2 font-semibold text-[var(--ink)] sm:text-apple-title1"
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-apple-footnote text-[var(--ink-muted)]">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children}
    </header>
  );
}

export default PageHeader;
