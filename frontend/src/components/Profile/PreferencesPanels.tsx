'use client';

import { useEffect, useState } from 'react';
import BrandingCard from './BrandingCard';
import AISettingsCard from './AISettingsCard';
import CompanyHolidayCard from './CompanyHolidayCard';
import DailyBriefingCard from './DailyBriefingCard';
import DateFormatCard from './DateFormatCard';
import ExternalNotificationCard from './ExternalNotificationCard';
import MainMenuCard from './MainMenuCard';
import NotificationSettingsCard from './NotificationSettingsCard';
import QuickLinksCard from './QuickLinksCard';
import ThemeCard from './ThemeCard';
import WorkspaceBackupCard from './WorkspaceBackupCard';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { MessageKey } from '@/lib/i18n/messages';
import type { MainMenuItemConfig } from '@/utils/mainMenu';
import type { QuickLink } from '@/utils/quickLinks';

export type PreferenceSection = 'appearance' | 'notifications' | 'alerts' | 'menu' | 'ai' | 'workspace';

/** One card on the page: where to scroll and what to call it. */
interface JumpItem {
  id: string;
  label: string | MessageKey;
  /** Already-translated strings (the two notification cards) skip i18n. */
  literal?: boolean;
}

/**
 * A tab can hold three or four long cards, and the one a user came for is often
 * the last. This bar lists what the page contains and scrolls to it, so nobody
 * has to scan a whole page to find the switch they want.
 */
function QuickJump({ items }: { items: JumpItem[] }) {
  const { t } = useI18n();
  if (items.length < 2) return null;

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      aria-label={t('card.jumpNav.label')}
      className="flex flex-wrap items-center gap-1.5 rounded-apple-lg border border-[var(--hairline-soft)] bg-[var(--surface-chip)] p-1.5 backdrop-blur-md"
    >
      <span className="px-1.5 text-[11px] font-bold text-[var(--ink-tertiary)]">
        {t('card.jumpNav.label')}
      </span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => jump(item.id)}
          className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)] transition-colors duration-150 hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.96]"
        >
          {item.literal ? item.label : t(item.label as MessageKey)}
        </button>
      ))}
    </nav>
  );
}

export default function PreferencesPanels({
  section,
  isAdmin,
  menuItems,
  onMoveMenuItem,
  quickLinks,
  onAddQuickLink,
  onEditQuickLink,
  onDeleteQuickLink,
  onMoveQuickLink,
}: {
  section: PreferenceSection;
  isAdmin: boolean;
  menuItems: MainMenuItemConfig[];
  onMoveMenuItem: (id: string, direction: 'up' | 'down') => void;
  quickLinks: QuickLink[];
  onAddQuickLink: () => void;
  onEditQuickLink: (link: QuickLink) => void;
  onDeleteQuickLink: (id: string) => void;
  onMoveQuickLink: (id: string, direction: 'up' | 'down') => void;
}) {
  // Mount a section the first time its tab is opened, and keep it mounted after
  // that so switching back is instant. Rendering all of them up front made the
  // page fire the AI, branding, holiday and notification requests before the
  // user had asked for any of those tabs.
  const [visited, setVisited] = useState<PreferenceSection[]>([section]);

  useEffect(() => {
    setVisited((prev) => (prev.includes(section) ? prev : [...prev, section]));
  }, [section]);

  const mounted = (...sections: PreferenceSection[]) =>
    sections.includes(section) || sections.some((id) => visited.includes(id));

  const appearanceJump: JumpItem[] = [
    { id: 'settings-theme', label: 'card.theme.title' },
    { id: 'settings-date-format', label: 'card.dateTime.title' },
    ...(isAdmin ? [{ id: 'settings-main-menu', label: 'card.mainMenu.title' as MessageKey }] : []),
    { id: 'settings-quick-links', label: 'card.quickLinks.title' },
  ];

  const notificationJump: JumpItem[] = [
    { id: 'settings-notifications', label: 'card.notifications.title' },
    { id: 'settings-daily-briefing', label: 'สรุปประจำวัน', literal: true },
    { id: 'settings-external', label: 'Telegram / Webhook', literal: true },
  ];

  const workspaceJump: JumpItem[] = [
    { id: 'settings-branding', label: 'แบรนด์องค์กร', literal: true },
    { id: 'settings-holidays', label: 'วันหยุดบริษัท', literal: true },
    { id: 'settings-backup', label: 'ข้อมูลสำรอง', literal: true },
  ];

  return (
    <>
      {/* ── Appearance & Navigation ── */}
      <div hidden={section !== 'appearance' && section !== 'menu'} className="space-y-5">
        {mounted('appearance', 'menu') && (
          <>
            <QuickJump items={appearanceJump} />
            <div id="settings-theme" className="scroll-mt-24">
              <ThemeCard />
            </div>
            <div id="settings-date-format" className="scroll-mt-24">
              <DateFormatCard />
            </div>
            <div className={isAdmin ? 'grid gap-5 lg:grid-cols-2' : ''}>
              {isAdmin && (
                <div id="settings-main-menu" className="scroll-mt-24">
                  <MainMenuCard items={menuItems} onMove={onMoveMenuItem} />
                </div>
              )}
              <div id="settings-quick-links" className="scroll-mt-24">
                <QuickLinksCard
                  links={quickLinks}
                  onAdd={onAddQuickLink}
                  onEdit={onEditQuickLink}
                  onDelete={onDeleteQuickLink}
                  onMove={onMoveQuickLink}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Notifications ── */}
      <div hidden={section !== 'notifications' && section !== 'alerts'} className="space-y-5">
        {mounted('notifications', 'alerts') && (
          <>
            <QuickJump items={notificationJump} />
            <div id="settings-notifications" className="scroll-mt-24">
              <NotificationSettingsCard />
            </div>
            <div id="settings-daily-briefing" className="scroll-mt-24">
              <DailyBriefingCard />
            </div>
            <div id="settings-external" className="scroll-mt-24">
              <ExternalNotificationCard />
            </div>
          </>
        )}
      </div>

      {/* ── AI Services ── */}
      <div hidden={section !== 'ai'} className="space-y-5">
        {mounted('ai') && <AISettingsCard />}
      </div>

      {/* ── Workspace (Admin) ── */}
      <div hidden={section !== 'workspace'} className="space-y-5">
        {mounted('workspace') && (
          <>
            <QuickJump items={workspaceJump} />
            <div id="settings-branding" className="scroll-mt-24">
              <BrandingCard isAdmin={isAdmin} />
            </div>
            {/* Company holidays live in general settings, not the admin console:
                every member can read the calendar, only an admin can change it. */}
            <div id="settings-holidays" className="scroll-mt-24">
              <CompanyHolidayCard canEdit={isAdmin} />
            </div>
            <div id="settings-backup" className="scroll-mt-24">
              <WorkspaceBackupCard />
            </div>
          </>
        )}
      </div>
    </>
  );
}
