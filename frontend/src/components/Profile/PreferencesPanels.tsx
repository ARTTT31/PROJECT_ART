'use client';

import BrandingCard from './BrandingCard';
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

export type PreferenceSection = 'menu' | 'appearance' | 'alerts' | 'workspace';

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
      <div hidden={section !== 'menu'} className="space-y-5">
        {/* Which pages exist in the sidebar is an admin decision: hiding
            this card keeps ordinary users from rearranging (or hiding)
            pages while the workspace is still being built. */}
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

      <div hidden={section !== 'appearance'}>
        <ThemeCard />
      </div>

      <div hidden={section !== 'alerts'} className="space-y-5">
        <NotificationSettingsCard />
        <DailyBriefingCard />
        <ExternalNotificationCard />
        <DateFormatCard />
      </div>

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
