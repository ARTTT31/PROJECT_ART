'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Lock,
  Sliders,
  LayoutGrid,
  Palette,
  Building2,
  BellRing,
  Sparkles,
} from 'lucide-react';
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert';
import { canAccessPage } from '@/utils/accessiblePages';
import { usePageHeading } from '@/components/ui/PageHeader';
import { useEnabledPages, isPageEnabled } from '@/hooks/useEnabledPages';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import AccountDetailsCard from '@/components/Profile/AccountDetailsCard';
import PasswordCard from '@/components/Profile/PasswordCard';
import { QuickLinkDialog, type QuickLinkFormValues } from '@/components/Profile/QuickLinkDialog';
import SecurityCard from '@/components/Profile/SecurityCard';
import { MyDevicesCard } from '@/components/Profile/MyDevicesCard';
import ProfileHero from '@/components/Profile/ProfileHero';
import PreferencesPanels, {
  type PreferenceSection,
} from '@/components/Profile/PreferencesPanels';
import { type QuickLink, parseQuickLinks, serializeQuickLinks } from '@/utils/quickLinks';
import {
  parseMainMenuConfig,
  serializeMainMenuConfig,
  MAIN_MENU_STORAGE_KEY,
  type MainMenuItemConfig,
} from '@/utils/mainMenu';
import type { AuthUser } from '@/types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Sub-section switcher: each tab shows one group of cards at a time, so the
 * preferences tab does not turn into a long wall of every setting at once.
 */
function SubNav<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon: React.ReactNode }>;
  onChange: (next: T) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-[18px] border border-[var(--hairline-soft)] bg-[var(--surface)] p-1.5 shadow-2xs"
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-[11px] px-3 py-2 text-[12px] font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              selected
                ? 'bg-[var(--accent)] text-white shadow-[0_4px_10px_-4px_var(--accent)]'
                : 'text-[var(--ink-muted)] hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)]'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Profile Page Component
// ─────────────────────────────────────────────────────────────

type TabKey = 'profile' | 'preferences';
type AccountSection = 'account' | 'security';

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, updateUser, logout } = useAuth();
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(authUser);
  const currentUser = user || authUser;
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [accountSection, setAccountSection] = useState<AccountSection>('account');
  const [preferenceSection, setPreferenceSection] = useState<PreferenceSection>('menu');

  // Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Quick Links
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(() =>
    parseQuickLinks(authUser?.quick_links)
  );
  const [quickLinkDialogOpen, setQuickLinkDialogOpen] = useState(false);
  const [editingQuickLink, setEditingQuickLink] = useState<QuickLink | null>(null);

  // Main Menu Config
  const [mainMenuConfig, setMainMenuConfig] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null);
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY);
    return parseMainMenuConfig(saved);
  });

  const enabledPages = useEnabledPages();
  const isAdmin = currentUser?.role === 'admin';
  // The profile card's name is this page's large title (see the h1 below).
  const headingRef = usePageHeading(currentUser?.name || 'โปรไฟล์');
  const filteredMenuItems = mainMenuConfig.filter((item) => {
    if (item.adminOnly && currentUser?.role !== 'admin') return false;
    const pageSwitch = enabledPages.find((p) => p.id === item.id);
    const enabled = pageSwitch ? pageSwitch.enabled : isPageEnabled(item.id);
    return canAccessPage(currentUser, item.id) && enabled;
  });

  // Sync the tab with the URL so a shared `?tab=preferences` link opens the
  // right section. Older `?tab=admin` links simply fall back to the profile tab.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('tab') || window.location.hash.replace('#', '');
      if (requested !== 'profile' && requested !== 'preferences') return;
      setActiveTab(requested);
    };

    applyTabFromUrl();
    window.addEventListener('popstate', applyTabFromUrl);
    window.addEventListener('hashchange', applyTabFromUrl);
    return () => {
      window.removeEventListener('popstate', applyTabFromUrl);
      window.removeEventListener('hashchange', applyTabFromUrl);
    };
  }, []);

  // The account's saved menu outranks this browser's cache, so a layout arranged
  // on another device shows up here. Accounts that still only have a local
  // config (everything saved before this column existed) push it up once.
  useEffect(() => {
    if (!authUser) return;

    if (authUser.main_menu) {
      const fromAccount = parseMainMenuConfig(authUser.main_menu);
      setMainMenuConfig(fromAccount);
      localStorage.setItem(MAIN_MENU_STORAGE_KEY, serializeMainMenuConfig(fromAccount));
      window.dispatchEvent(new Event('art-main-menu-updated'));
      return;
    }

    const localOnly = localStorage.getItem(MAIN_MENU_STORAGE_KEY);
    if (!localOnly) return;
    void fetchWithAuth('/api/v1/profile/main-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main_menu: localOnly }),
    })
      .then(() => updateUser({ main_menu: localOnly }))
      .catch(() => {
        /* the next visit retries; nothing to show the user for a silent sync */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.main_menu, authUser?.id]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'profile') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tab);
      }
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    }
  };

  // ── Main Menu Handlers ────────────────────────────────────────

  const saveMainMenu = (items: MainMenuItemConfig[]) => {
    const serialized = serializeMainMenuConfig(items);
    // localStorage stays as an instant local cache (the sidebar reads it before
    // any network round-trip); the account row is what makes the choice follow
    // the user to another browser or device.
    localStorage.setItem(MAIN_MENU_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event('art-main-menu-updated'));
    setMainMenuConfig(items);
    updateUser({ main_menu: serialized });

    void fetchWithAuth('/api/v1/profile/main-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main_menu: serialized }),
    }).catch(() => {
      showError('บันทึกเมนูไม่สำเร็จ', 'การเปลี่ยนแปลงถูกเก็บไว้ในเครื่องนี้ แต่ยังไม่ซิงก์ขึ้นเซิร์ฟเวอร์');
    });
  };

  const moveMainMenuItem = (id: string, dir: 'up' | 'down') => {
    const visibleIdx = filteredMenuItems.findIndex((item) => item.id === id);
    if (visibleIdx === -1) return;
    const targetVisibleIdx = dir === 'up' ? visibleIdx - 1 : visibleIdx + 1;
    if (targetVisibleIdx < 0 || targetVisibleIdx >= filteredMenuItems.length) return;
    const targetId = filteredMenuItems[targetVisibleIdx].id;

    const idx = mainMenuConfig.findIndex((item) => item.id === id);
    const target = mainMenuConfig.findIndex((item) => item.id === targetId);
    if (idx === -1 || target === -1) return;
    const newList = [...mainMenuConfig];
    [newList[idx], newList[target]] = [newList[target], newList[idx]];
    saveMainMenu(newList);
  };

  // ── Init ──────────────────────────────────────────────────────

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      setQuickLinks(parseQuickLinks(authUser.quick_links));
    }
  }, [authUser]);

  // ── Handlers: Avatar Upload ───────────────────────────────────

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate size (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      showToast('ขนาดไฟล์รูปภาพห้ามเกิน 1MB', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate mime type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      showToast('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, GIF เท่านั้น', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingAvatar(true);
    try {
      const response = await fetchWithAuth('/api/v1/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        // Re-fetch profile to get updated base64 avatar
        const profRes = await fetchWithAuth('/api/v1/profile/me');
        if (profRes.ok) {
          const fresh = await profRes.json();
          updateUser({ avatar: fresh.avatar });
          setUser((prev) => (prev ? { ...prev, avatar: fresh.avatar } : null));
          window.dispatchEvent(new Event('user-profile-updated'));
        }
        showSuccess('สำเร็จ', data.message || 'อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว!');
      } else {
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'ไม่สามารถอัปโหลดรูปภาพได้'));
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Handlers: Quick Links ─────────────────────────────────────

  const openCreateQuickLink = () => {
    setEditingQuickLink(null);
    setQuickLinkDialogOpen(true);
  };

  const openEditQuickLink = (link: QuickLink) => {
    setEditingQuickLink(link);
    setQuickLinkDialogOpen(true);
  };

  const persistQuickLinks = async (nextLinks: QuickLink[]) => {
    if (!user) return false;
    try {
      const raw = serializeQuickLinks(nextLinks);
      const response = await fetchWithAuth('/api/v1/profile/quick-links', {
        method: 'POST',
        body: JSON.stringify({ quick_links: raw }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: '' }));
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'ไม่สามารถบันทึก Quick Links ได้'));
        return false;
      }
      const updatedUser: AuthUser = { ...user, quick_links: raw };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      updateUser({ quick_links: raw });
      window.dispatchEvent(new Event('user-profile-updated'));
      setQuickLinks(nextLinks);
      return true;
    } catch (error) {
      console.error('Quick links update error:', error);
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      return false;
    }
  };

  const handleSubmitQuickLink = async (values: QuickLinkFormValues) => {
    const next: QuickLink = {
      id:
        editingQuickLink?.id ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      label: values.label,
      url: values.url,
      icon: values.icon,
      color: values.color || undefined,
      envs: values.envs,
    };
    const nextLinks = editingQuickLink
      ? quickLinks.map((l) => (l.id === editingQuickLink.id ? next : l))
      : [...quickLinks, next];
    const ok = await persistQuickLinks(nextLinks);
    if (ok) showSuccess('สำเร็จ', 'บันทึก Quick Links สำเร็จแล้ว');
    return ok;
  };

  const handleMoveQuickLink = async (id: string, direction: 'up' | 'down') => {
    const idx = quickLinks.findIndex((l) => l.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === quickLinks.length - 1) return;
    const next = [...quickLinks];
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    await persistQuickLinks(next);
  };

  const handleDeleteQuickLink = async (id: string) => {
    const result = await showDeleteConfirm('ลบควิกลิ้งค์?', 'ต้องการลบควิกลิ้งค์นี้ใช่หรือไม่');
    if (!result.isConfirmed) return;
    const nextLinks = quickLinks.filter((l) => l.id !== id);
    const ok = await persistQuickLinks(nextLinks);
    if (ok) showSuccess('สำเร็จ', 'ลบควิกลิ้งค์เรียบร้อยแล้ว');
  };

  // ── Loading State ─────────────────────────────────────────────

  if (!currentUser) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--surface-grouped)] border-t-[var(--accent)]" />
          <span className="text-[13px] font-medium text-[var(--ink-muted)]">กำลังโหลดข้อมูลโปรไฟล์…</span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-12">
      {/* ══════════════════════════════════════════════════
          HERO IDENTITY CARD (Apple-style Header Banner)
          ══════════════════════════════════════════════════ */}
      <ProfileHero
        name={currentUser.name}
        email={currentUser.email}
        username={currentUser.username}
        avatar={currentUser.avatar}
        isAdmin={isAdmin}
        avatarInputRef={fileInputRef}
        isUploadingAvatar={isUploadingAvatar}
        onAvatarFileSelect={handleAvatarFileSelect}
        onPickAvatar={() => fileInputRef.current?.click()}
        headingRef={headingRef}
      />

      {/* ══════════════════════════════════════════════════
          RESPONSIVE NAVIGATION TABS (Segmented Control)
          ══════════════════════════════════════════════════ */}
      <nav
        aria-label="แท็บตั้งค่าโปรไฟล์"
        className="inline-flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-[18px] border border-[var(--hairline-soft)] bg-[var(--surface-chip)] p-1 backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={`inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 rounded-[14px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
            activeTab === 'profile'
              ? 'bg-[var(--surface)] text-[var(--accent-text)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-60)]'
          }`}
        >
          <User size={15} />
          <span>{t('profile.tab.profile')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('preferences')}
          className={`inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 rounded-[14px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
            activeTab === 'preferences'
              ? 'bg-[var(--surface)] text-[var(--accent-text)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-60)]'
          }`}
        >
          <Sliders size={15} />
          <span>{t('profile.tab.preferences')}</span>
        </button>
      </nav>

      {/* Sub-sections: the cards of one group at a time. */}
      {activeTab === 'profile' ? (
        <SubNav
          label={t('profile.sub.label.account')}
          value={accountSection}
          onChange={setAccountSection}
          options={[
            {
              value: 'account',
              label: t('profile.sub.account'),
              icon: <User size={13} aria-hidden="true" />,
            },
            {
              value: 'security',
              label: t('profile.sub.security'),
              icon: <Lock size={13} aria-hidden="true" />,
            },
          ]}
        />
      ) : (
        <SubNav
          label={t('profile.sub.label.preferences')}
          value={preferenceSection}
          onChange={setPreferenceSection}
          options={[
            {
              value: 'menu',
              label: t('profile.sub.menu'),
              icon: <LayoutGrid size={13} aria-hidden="true" />,
            },
            {
              value: 'appearance',
              label: t('profile.sub.appearance'),
              icon: <Palette size={13} aria-hidden="true" />,
            },
            {
              value: 'alerts',
              label: t('profile.sub.alerts'),
              icon: <BellRing size={13} aria-hidden="true" />,
            },
            {
              value: 'ai',
              label: t('profile.sub.ai'),
              icon: <Sparkles size={13} aria-hidden="true" />,
            },
            {
              value: 'workspace',
              label: t('profile.sub.workspace'),
              icon: <Building2 size={13} aria-hidden="true" />,
            },
          ]}
        />
      )}

      {/* ══════════════════════════════════════════════════
          TAB 1: ข้อมูลส่วนตัว & ความปลอดภัย
          ══════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="min-h-[480px]"
          >
            <div hidden={accountSection !== 'account'}>
              <AccountDetailsCard
                user={currentUser}
                onUpdated={(patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev))}
              />
            </div>

            <div hidden={accountSection !== 'security'}>
              <PasswordCard user={currentUser} />

              {/* Card 1.3: การยืนยันสองขั้นตอน */}
              <div className="mt-4">
                <SecurityCard />
              </div>

              {/* Card 1.4: อุปกรณ์ที่เข้าสู่ระบบของฉัน */}
              <div className="mt-4">
                <MyDevicesCard />
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════
          TAB 2: ทางลัด & ปรับแต่งเมนู
          ══════════════════════════════════════════════════ */}
        {activeTab === 'preferences' && (
          <motion.div
            key="preferences"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="grid min-h-[480px] grid-cols-1 gap-5 items-start"
          >
            <PreferencesPanels
              section={preferenceSection}
              isAdmin={isAdmin}
              menuItems={filteredMenuItems}
              onMoveMenuItem={moveMainMenuItem}
              quickLinks={quickLinks}
              onAddQuickLink={openCreateQuickLink}
              onEditQuickLink={openEditQuickLink}
              onDeleteQuickLink={handleDeleteQuickLink}
              onMoveQuickLink={handleMoveQuickLink}
            />
          </motion.div>
        )}

      </AnimatePresence>

      <QuickLinkDialog
        open={quickLinkDialogOpen}
        onOpenChange={setQuickLinkDialogOpen}
        link={editingQuickLink}
        onSubmit={handleSubmitQuickLink}
      />
    </div>
  );
}
