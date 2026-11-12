'use client';

import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, Menu, Search } from 'lucide-react';
import { AuthUser } from '@/types';
import NotificationBell from './NotificationBell';
import { openCommandPalette } from './CommandPalette';
import { PwaHeaderButton } from '@/components/PWA/PwaInstallPrompt';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { usePreferences } from '@/hooks/usePreferences';
import { formatClock } from '@/utils/dateFormat';
import {
  getPageTitleServerSnapshot,
  getPageTitleSnapshot,
  subscribePageTitle,
} from '@/lib/pageTitleStore';

interface HeaderProps {
  user?: AuthUser | null;
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
}

export default function Header({ user, onMenuClick, sidebarCollapsed = false }: HeaderProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const pageTitle = useSyncExternalStore(
    subscribePageTitle,
    getPageTitleSnapshot,
    getPageTitleServerSnapshot,
  );

  const headerMeta: { title: string; crumbs: Array<{ label: string; href?: string }> } = (() => {
    const home = { label: t('breadcrumb.home'), href: '/dashboard' };

    if (pathname.startsWith('/camera')) {
      return { title: t('page.camera'), crumbs: [home, { label: t('page.camera') }] };
    }

    if (pathname.startsWith('/admin')) {
      return { title: t('page.admin'), crumbs: [home, { label: t('page.admin') }] };
    }

    if (pathname.startsWith('/audit')) {
      return { title: t('page.audit'), crumbs: [home, { label: t('page.audit') }] };
    }

    if (pathname.startsWith('/profile')) {
      return { title: t('page.profile'), crumbs: [home, { label: t('page.profile') }] };
    }

    if (pathname.startsWith('/notifications')) {
      return { title: 'การแจ้งเตือน', crumbs: [home, { label: 'การแจ้งเตือน' }] };
    }

    // default: dashboard
    return {
      title: t('page.dashboard.title'),
      crumbs: [{ label: t('breadcrumb.home') }, { label: t('page.dashboard.title') }],
    };
  })();

  const currentTitle = headerMeta.title || pageTitle.title || 'ART Workspace';

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-[var(--apple-nav-bg)] backdrop-blur-2xl transition-all">
      <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">
        {/* Left Side: Sidebar Toggle & Page Title/Breadcrumb */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onMenuClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink)] transition-all duration-150 hover:bg-[var(--surface-chip)] active:scale-[0.95] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label={t(sidebarCollapsed ? 'nav.menuToggle.open' : 'nav.menuToggle.close')}
            aria-pressed={!sidebarCollapsed}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-[15px] sm:text-[16px] font-bold tracking-tight text-[var(--ink)] leading-tight">
              {currentTitle}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <nav
                aria-label="breadcrumb"
                className="flex items-center gap-1.5 text-[11px] sm:text-[12px] font-medium text-[var(--ink-tertiary)]"
              >
                {headerMeta.crumbs.map((c, idx) => {
                  const isLast = idx === headerMeta.crumbs.length - 1;
                  return (
                    <span key={`${c.label}-${idx}`} className="flex items-center gap-1.5">
                      {c.href ? (
                        <Link href={c.href} className="transition-colors hover:text-[var(--ink)]">
                          {c.label}
                        </Link>
                      ) : (
                        <span className={isLast ? 'text-[var(--ink-secondary)]' : ''}>{c.label}</span>
                      )}
                      {!isLast && (
                        <span aria-hidden="true" className="text-[var(--ink-faint)]">
                          /
                        </span>
                      )}
                    </span>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Right Side: Clock, Notification Bell & User Profile Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <PwaHeaderButton />
          <div className="hidden min-h-[36px] items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--glass-80)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:flex">
            <ClockTime />
          </div>

          {/* The palette is keyboard-first, but a feature nobody can see is a
              feature nobody uses; this is its visible entry point. */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label={t('nav.search.aria')}
            title={t('nav.search.title')}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--glass-80)] px-2.5 text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] xl:pr-2"
          >
            <Search size={16} aria-hidden="true" />
            <span className="hidden text-[12px] font-semibold xl:inline">
              {t('nav.search.label')}
            </span>
            {/* The shortcut is Ctrl+K here — the app targets Windows users, so
                the macOS command glyph read as a mystery symbol. */}
            <kbd className="hidden rounded-apple-xs border border-[var(--hairline)] bg-[var(--surface)] px-1.5 py-0.5 font-sans text-[10px] font-bold text-[var(--ink-tertiary)] xl:inline">
              Ctrl K
            </kbd>
          </button>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

/** Isolated clock component – only this subtree re-renders every second */
const ClockTime = memo(function ClockTime() {
  const preferences = usePreferences();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  const formatted = formatClock(time, preferences);
  return (
    <>
      <Clock size={14} className="text-[var(--accent-text)]" aria-hidden="true" />
      <span suppressHydrationWarning>{formatted}</span>
    </>
  );
});
