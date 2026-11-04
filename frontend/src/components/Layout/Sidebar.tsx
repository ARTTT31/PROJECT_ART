'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, ExternalLink, Sparkles } from 'lucide-react';
import {
  QUICK_LINK_ENVIRONMENT_LABELS,
  QUICK_LINK_ICON_MAP,
  isExternalUrl,
  isQuickLinkVisible,
  newQuickLinkId,
  parseQuickLinks,
  quickLinkEnvironmentOptions,
  resolveQuickLinkUrl,
  type QuickLink,
} from '@/utils/quickLinks';
import { useQuickLinkEnvironment } from '@/hooks/useQuickLinkEnvironment';
import {
  dismissQuickLinkSuggestion,
  findQuickLinkSuggestion,
  recordPageVisit,
  type PageVisits,
} from '@/utils/quickLinkSuggestions';
import { persistQuickLinks } from '@/lib/api/quickLinks';
import { useAuth } from '@/hooks/useAuth';
import {
  parseMainMenuConfig,
  MAIN_MENU_ICON_MAP,
  MAIN_MENU_STORAGE_KEY,
  MainMenuItemConfig,
} from '@/utils/mainMenu';
import { canAccessPage } from '@/utils/accessiblePages';
import { isPageEnabled } from '@/hooks/useEnabledPages';
import { AuthUser } from '@/types';
import { useBranding } from '@/context/BrandingContext';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed?: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}

interface MenuItem {
  name: string;
  href: string;
  icon: ReactElement;
  external?: boolean;
  isWip?: boolean;
  wipLabel?: string;
  /** Environment chip + switcher for links that offer more than one target. */
  environments?: { label: string; onCycle: () => void };
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function Sidebar({
  isOpen,
  isCollapsed = false,
  onClose,
  user,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const { companyName, companyTagline, brandLogoUrl } = useBranding();
  const { updateUser } = useAuth();

  // The account's config wins: it is the value that travels between devices.
  // localStorage is only a fast first paint / offline fallback.
  const resolveMenu = () => {
    if (user?.main_menu) return parseMainMenuConfig(user.main_menu);
    if (typeof window === 'undefined') return parseMainMenuConfig(null);
    return parseMainMenuConfig(localStorage.getItem(MAIN_MENU_STORAGE_KEY));
  };

  const [mainMenuConfig, setMainMenuConfig] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null);
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY);
    return parseMainMenuConfig(saved);
  });

  useEffect(() => {
    setMainMenuConfig(resolveMenu());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.main_menu]);

  // Pages this browser opened, used to offer "save this page as a shortcut".
  const [visits, setVisits] = useState<PageVisits>({});
  const [hiddenSuggestions, setHiddenSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!pathname) return;
    setVisits(recordPageVisit(pathname));
  }, [pathname]);

  // Listen for changes from Profile Page
  useEffect(() => {
    const handleMenuUpdate = () => {
      const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY);
      setMainMenuConfig(parseMainMenuConfig(saved));
    };
    window.addEventListener('art-main-menu-updated', handleMenuUpdate);
    window.addEventListener('storage', handleMenuUpdate);
    return () => {
      window.removeEventListener('art-main-menu-updated', handleMenuUpdate);
      window.removeEventListener('storage', handleMenuUpdate);
    };
  }, []);

  const quickLinks = parseQuickLinks(user?.quick_links);

  // An in-app quick link obeys the same page gate as the main menu. A bookmark
  // in the browser cannot know this account may not open /camera — a shortcut
  // that lives inside the workspace has no excuse.
  const visibleQuickLinks = quickLinks.filter((ql) => isQuickLinkVisible(ql, user));
  const { get: getEnvironment, select: selectEnvironment } = useQuickLinkEnvironment();

  const quickLinkSection: MenuSection | null =
    visibleQuickLinks.length > 0
      ? {
          title: 'ควิกลิ้งค์',
          items: visibleQuickLinks.map((ql) => {
            const Icon = QUICK_LINK_ICON_MAP[ql.icon];
            const options = quickLinkEnvironmentOptions(ql);
            const selected = getEnvironment(ql.id);
            const target = resolveQuickLinkUrl(ql, selected);
            return {
              name: ql.label,
              href: target,
              external: isExternalUrl(target),
              environments:
                options.length > 1
                  ? {
                      label: QUICK_LINK_ENVIRONMENT_LABELS[selected],
                      onCycle: () => {
                        const index = options.findIndex((option) => option.key === selected);
                        selectEnvironment(ql.id, options[(index + 1) % options.length].key);
                      },
                    }
                  : undefined,
              icon: <Icon size={20} aria-hidden="true" style={{ color: ql.color || undefined }} />,
            };
          }),
        }
      : null;

  // "You keep opening this page" — offered only for pages that are not already
  // one click away in the enabled menu.
  const suggestion = findQuickLinkSuggestion({
    visits,
    links: quickLinks,
    mainMenu: mainMenuConfig,
    dismissed: hiddenSuggestions,
  });

  const closeSuggestion = (path: string) =>
    setHiddenSuggestions((previous) => [...previous, path]);

  const handleAcceptSuggestion = async () => {
    if (!suggestion) return;
    const next: QuickLink = {
      id: newQuickLinkId(),
      label: suggestion.label,
      url: suggestion.path,
      icon: suggestion.icon,
    };
    const raw = await persistQuickLinks([...quickLinks, next]);
    if (!raw) return;
    updateUser({ quick_links: raw });
    closeSuggestion(suggestion.path);
  };

  const handleDismissSuggestion = () => {
    if (!suggestion) return;
    dismissQuickLinkSuggestion(suggestion.path);
    closeSuggestion(suggestion.path);
  };

  // Active Main Menu Items based on user configuration. The same rule (and the
  // same parser) as the server-side gate in app/api/dependencies.py.
  // The saved config only orders the menu now; whether an item shows at all is
  // decided by the account's grant and the workspace page switches in /admin,
  // so a stale `enabled: false` from the old per-user toggle cannot hide a page.
  const enabledMainItems = mainMenuConfig.filter((item) => {
    // Admin-only pages (e.g. the activity log) never appear for regular accounts.
    if (item.adminOnly && user?.role !== 'admin') return false;
    // Two gates: the account's own grant, and whether the workspace has the
    // page open at all (the admin page-switch card).
    return canAccessPage(user, item.id) && isPageEnabled(item.id);
  });

  const mainMenuItemsSection: MenuSection = {
    title: 'เมนูหลัก',
    items: enabledMainItems.map((item) => {
      const Icon = MAIN_MENU_ICON_MAP[item.icon] || Sparkles;
      return {
        name: item.name,
        href: item.href,
        icon: <Icon size={20} aria-hidden="true" />,
        isWip: item.isWip,
        wipLabel: item.wipLabel,
      };
    }),
  };

  const menuSections: MenuSection[] = [
    mainMenuItemsSection,
    ...(quickLinkSection ? [quickLinkSection] : []),
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen w-[80vw] max-w-64 border-r border-[var(--hairline)] bg-[var(--apple-nav-bg)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[var(--ink)] transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
    >
      <div className="flex h-full flex-col">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--hairline)] bg-[var(--glass-40)]">
          <Image
            src={brandLogoUrl || '/art-workspace-mark.svg'}
            alt={companyName}
            width={34}
            height={34}
            className="rounded-[10px] shrink-0 object-contain shadow-2xs"
            priority
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13.5px] font-bold text-[var(--ink)] tracking-tight">
              {companyName}
            </h2>
            <p className="truncate text-[11px] text-[var(--ink-tertiary)]">{companyTagline || 'Workspace'}</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3.5 pt-4">
          <div className="space-y-6">
            {menuSections.map((section) => (
              <div key={section.title}>
                <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-[var(--ink-tertiary)]">
                  {section.title}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = !item.external && pathname === item.href;
                    const ItemComponent = item.external ? 'a' : Link;

                    return (
                      <li key={item.name} className="flex items-center gap-1">
                        <ItemComponent
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noopener noreferrer' : undefined}
                          className={`group flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 rounded-[11px] px-3 py-2 text-[14px] font-semibold transition-all duration-150 active:scale-[0.95] ${
                            isActive
                              ? 'bg-[var(--accent)] text-white'
                              : 'text-[var(--ink)] hover:bg-black/[0.05] hover:text-[var(--ink)]'
                          }`}
                          onClick={() => !item.external && onClose()}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors ${
                              isActive
                                ? 'bg-[var(--glass-20)] text-white'
                                : 'text-[var(--ink-muted)] group-hover:text-[var(--ink)]'
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="flex-1 truncate">{item.name}</span>

                          {/* WIP Indicator Badge */}
                          {item.isWip && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isActive
                                  ? 'bg-[var(--glass-20)] text-white'
                                  : 'bg-[var(--warning-soft)] text-[var(--warning)]'
                              }`}
                            >
                              {item.wipLabel || 'WIP'}
                            </span>
                          )}

                          {item.external && (
                            <ExternalLink
                              size={12}
                              aria-hidden="true"
                              className={isActive ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}
                            />
                          )}
                        </ItemComponent>

                        {/* Environment switcher: same shortcut, different target. */}
                        {item.environments && (
                          <button
                            type="button"
                            onClick={item.environments.onCycle}
                            aria-label={`สลับสภาพแวดล้อม of ${item.name} (ตอนนี้ ${item.environments.label})`}
                            title="สลับสภาพแวดล้อม"
                            className="shrink-0 rounded-full bg-[var(--surface-grouped-2)] px-1.5 py-1 text-[9.5px] font-bold text-[var(--ink-muted)] ring-1 ring-black/[0.04] transition-colors hover:text-[var(--ink)]"
                          >
                            {item.environments.label}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {suggestion && (
            <div className="mt-4 rounded-[11px] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-subtle)] p-3">
              <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
                คุณเปิด <span className="font-bold text-[var(--ink)]">{suggestion.path}</span>{' '}
                {suggestion.count} ครั้งแล้ว — เก็บเป็นควิกลิ้งค์?
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAcceptSuggestion}
                  className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10.5px] font-bold text-white transition-all hover:bg-[var(--accent-hover)] active:scale-95"
                >
                  เก็บไว้
                </button>
                <button
                  type="button"
                  onClick={handleDismissSuggestion}
                  className="rounded-full bg-[var(--surface-grouped-2)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--ink-muted)] transition-all hover:bg-[var(--surface-chip)]"
                >
                  ไม่ต้อง
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Logout Button */}
        <div className="border-t border-[var(--hairline)] p-3.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex min-h-[48px] w-full items-center gap-2.5 rounded-[11px] px-3 py-2 text-[14px] font-semibold text-[var(--danger)] transition-all duration-150 hover:bg-[var(--danger-soft)] active:scale-[0.95] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
            aria-label="ออกจากระบบ"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--danger-soft)] text-[var(--danger)]">
              <LogOut size={16} aria-hidden="true" />
            </span>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
