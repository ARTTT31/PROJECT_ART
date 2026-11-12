'use client';

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
import type { MainMenuItemConfig } from '@/utils/mainMenu';
import type { QuickLink } from '@/utils/quickLinks';

export type PreferenceSection = 'appearance' | 'notifications' | 'alerts' | 'menu' | 'ai' | 'workspace';

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
  return (
    <>
      {/* ── Appearance & Navigation ── */}
      <div hidden={section !== 'appearance' && section !== 'menu'} className="space-y-5">
        <ThemeCard />
        <DateFormatCard />
        <div className={isAdmin ? 'grid gap-5 lg:grid-cols-2' : ''}>
          {isAdmin && <MainMenuCard items={menuItems} onMove={onMoveMenuItem} />}
          <QuickLinksCard
            links={quickLinks}
            onAdd={onAddQuickLink}
            onEdit={onEditQuickLink}
            onDelete={onDeleteQuickLink}
            onMove={onMoveQuickLink}
          />
        </div>
      </div>

      {/* ── Notifications ── */}
      <div hidden={section !== 'notifications' && section !== 'alerts'} className="space-y-5">
        <NotificationSettingsCard />
        <DailyBriefingCard />
        <ExternalNotificationCard />
      </div>

      {/* ── AI Services ── */}
      <div hidden={section !== 'ai'} className="space-y-5">
        <AISettingsCard />
      </div>

      {/* ── Workspace (Admin) ── */}
      <div hidden={section !== 'workspace'} className="space-y-5">
        <BrandingCard isAdmin={isAdmin} />
        {/* Company holidays live in general settings, not the admin console:
            every member can read the calendar, only an admin can change it. */}
        <CompanyHolidayCard canEdit={isAdmin} />
        <WorkspaceBackupCard />
      </div>
    </>
  );
}
