'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Lock,
  Info,
  Check,
  Save,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  AtSign,
  ShieldAlert,
  Sliders,
  LayoutGrid,
  Palette,
  Building2,
  BellRing,
  Camera,
  Loader2,
  Download,
} from 'lucide-react';
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert';
import { canAccessPage } from '@/utils/accessiblePages';
import { usePageHeading } from '@/components/ui/PageHeader';
import { useEnabledPages, isPageEnabled } from '@/hooks/useEnabledPages';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { InsetField, SectionCard } from '@/components/Profile/SectionCard';
import { MainMenuCard } from '@/components/Profile/MainMenuCard';
import { QuickLinksCard } from '@/components/Profile/QuickLinksCard';
import { QuickLinkDialog, type QuickLinkFormValues } from '@/components/Profile/QuickLinkDialog';
import { BrandingCard } from '@/components/Profile/BrandingCard';
import CompanyHolidayCard from '@/components/Profile/CompanyHolidayCard';
import WorkspaceBackupCard from '@/components/Profile/WorkspaceBackupCard';
import NotificationSettingsCard from '@/components/Profile/NotificationSettingsCard';
import DateFormatCard from '@/components/Profile/DateFormatCard';
import { ThemeCard } from '@/components/Profile/ThemeCard';
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

/** Extract readable error message from API response body, handling Pydantic arrays */
function apiMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────
// Main Profile Page Component
// ─────────────────────────────────────────────────────────────

type TabKey = 'profile' | 'preferences';
type AccountSection = 'account' | 'security';
type PreferenceSection = 'menu' | 'appearance' | 'alerts' | 'workspace';

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

  // Personal Info Form
  const [name, setName] = useState(authUser?.name || '');
  const [email, setEmail] = useState(authUser?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetchWithAuth('/api/v1/profile/export');
      if (!res.ok) throw new Error('ไม่สามารถดาวน์โหลดข้อมูลได้');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `art-workspace-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('ดาวน์โหลดสำเนาข้อมูลเรียบร้อย', 'success');
    } catch {
      showToast('เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Password & Security Form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
      setName(authUser.name || '');
      setEmail(authUser.email || '');
      setQuickLinks(parseQuickLinks(authUser.quick_links));
    }
  }, [authUser]);

  // ── Password strength ─────────────────────────────────────────

  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (newPassword.length >= 12) strength++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++;
    if (/\d/.test(newPassword)) strength++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) strength++;
    setPasswordStrength(strength);
  }, [newPassword]);

  const getStrengthLabel = () => {
    if (passwordStrength <= 1)
      return { label: 'อ่อนแอ', color: 'bg-rose-500', text: 'text-rose-700' };
    if (passwordStrength === 2)
      return { label: 'ปานกลาง', color: 'bg-amber-500', text: 'text-amber-700' };
    if (passwordStrength === 3) return { label: 'ดี', color: 'bg-lime-500', text: 'text-lime-700' };
    if (passwordStrength === 4)
      return { label: 'แข็งแรง', color: 'bg-emerald-500', text: 'text-emerald-700' };
    return { label: 'ปลอดภัยสูง', color: 'bg-teal-500', text: 'text-teal-700' };
  };

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

  // ── Handlers: Profile ─────────────────────────────────────────

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const response = await fetchWithAuth('/api/v1/profile/me', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        updateUser({ name, email });
        setUser((prev) => (prev ? { ...prev, name, email } : null));
        window.dispatchEvent(new Event('user-profile-updated'));
        showSuccess('สำเร็จ', data.message || 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว!');
      } else {
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์'));
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      showToast('กรุณากรอกรหัสผ่านปัจจุบัน', 'warning');
      return;
    }
    if (!newPassword) {
      showToast('กรุณากรอกรหัสผ่านใหม่', 'warning');
      return;
    }
    if (newPassword.length < 8) {
      showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', 'warning');
      return;
    }
    if (!confirmPassword) {
      showToast('กรุณากรอกยืนยันรหัสผ่านใหม่', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่', 'warning');
      return;
    }
    if (passwordStrength < 3) {
      showToast('รหัสผ่านยังไม่แข็งแรงพอ กรุณาเพิ่มตัวเลขหรืออักขระพิเศษ', 'warning');
      return;
    }
    if (!user) {
      showError('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่');
      router.push('/login');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetchWithAuth('/api/v1/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        showSuccess('สำเร็จ', data.message || 'เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showError('เกิดข้อผิดพลาด', apiMessage(data, 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'));
      }
    } catch (error) {
      console.error('Password change error:', error);
      showError('ไม่สามารถเชื่อมต่อได้', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsChangingPassword(false);
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

  const strengthMeta = getStrengthLabel();

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-12">
      {/* ══════════════════════════════════════════════════
          HERO IDENTITY CARD (Apple-style Header Banner)
          ══════════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-[18px] bg-[var(--surface)] border border-[var(--hairline)] p-5 sm:p-7 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          {/* Left: Avatar + Identity */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0 group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleAvatarFileSelect}
                className="hidden"
                aria-label="อัปโหลดรูปโปรไฟล์"
              />

              {currentUser.avatar ? (
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-[18px] ring-4 ring-[var(--hairline-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name || 'โปรไฟล์'}
                    className="h-full w-full object-cover"
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-[18px] bg-[var(--accent)] text-2xl sm:text-3xl font-extrabold text-white ring-4 ring-[var(--hairline-soft)]">
                  {isUploadingAvatar ? (
                    <Loader2 size={24} className="animate-spin text-white" />
                  ) : (
                    currentUser.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
              )}

              {/* Upload photo button badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="เปลี่ยนรูปโปรไฟล์ (ไม่เกิน 1MB)"
                aria-label="เปลี่ยนรูปโปรไฟล์"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--hairline)] transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
              >
                <Camera size={13} className="text-[var(--accent-text)]" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  ref={headingRef}
                  className="truncate text-apple-title2 font-semibold text-[var(--ink)]"
                >
                  {currentUser.name || 'ผู้ใช้งาน'}
                </h1>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 ring-1 ring-purple-600/20">
                    <ShieldAlert size={11} /> จัดการระบบ (Admin)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-500/20">
                    <User size={11} /> ผู้ใช้ทั่วไป (User)
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} className="text-[var(--ink-tertiary)]" />
                  {currentUser.email || 'ไม่ได้ระบุอีเมล'}
                </span>
                {currentUser.username && (
                  <span className="inline-flex items-center gap-1">
                    <AtSign size={12} className="text-[var(--ink-tertiary)]" />
                    {currentUser.username}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

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
              {/* Card 1.1: ข้อมูลส่วนตัว */}
            <SectionCard
              icon={<User size={19} aria-hidden="true" />}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              iconRing="ring-emerald-200/60"
              title="ข้อมูลส่วนตัว"
              subtitle="อัปเดตชื่อที่แสดงและอีเมลสำหรับใช้งานในระบบ"
            >
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <InsetField
                  id="profile-name"
                  label="ชื่อที่แสดง"
                  value={name}
                  onChange={setName}
                  placeholder="เช่น สมชาย ใจดี"
                  icon={<User size={16} aria-hidden="true" />}
                  required
                />
                <InsetField
                  id="profile-email"
                  label="อีเมลสำหรับเข้าสู่ระบบ"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="name@company.com"
                  icon={<Mail size={16} aria-hidden="true" />}
                  required
                  autoComplete="email"
                />
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {isSavingProfile ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                    ) : (
                      <Check size={14} aria-hidden="true" />
                    )}
                    {isSavingProfile ? 'กำลังบันทึก…' : 'บันทึกข้อมูลส่วนตัว'}
                  </button>
                </div>
              </form>
            </SectionCard>

              {/* Card: ดาวน์โหลดข้อมูลบัญชี (Data Export) */}
              <div className="mt-4">
                <SectionCard
                  icon={<Download size={19} aria-hidden="true" />}
                  iconBg="bg-blue-50"
                  iconColor="text-[var(--accent)]"
                  iconRing="ring-blue-200/60"
                  title="สำเนาข้อมูลบัญชี (Data Export)"
                  subtitle="ดาวน์โหลดข้อมูลทั้งหมดของคุณในรูปแบบ JSON เพื่อเก็บสำรอง"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
                    <div className="text-[13px] text-[var(--ink-muted)] leading-relaxed">
                      ดาวน์โหลดข้อมูลส่วนตัว ข้อมูลโปรไฟล์ การตั้งค่า และประวัติที่เกี่ยวข้องในรูปแบบไฟล์ JSON
                    </div>
                    <button
                      type="button"
                      onClick={handleExportData}
                      disabled={isExporting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--ink)] shadow-xs transition-all duration-150 hover:bg-[var(--surface-subtle)] hover:text-[var(--accent)] disabled:opacity-50 active:scale-[0.96] shrink-0"
                    >
                      {isExporting ? (
                        <Loader2 size={15} className="animate-spin text-[var(--accent)]" />
                      ) : (
                        <Download size={15} aria-hidden="true" />
                      )}
                      {isExporting ? 'กำลังสร้างไฟล์…' : 'ส่งออกข้อมูล (JSON)'}
                    </button>
                  </div>
                </SectionCard>
              </div>
            </div>

            <div hidden={accountSection !== 'security'}>
              {/* Card 1.2: รหัสผ่าน & ความปลอดภัย */}
            <SectionCard
              icon={<Lock size={19} aria-hidden="true" />}
              iconBg="bg-rose-50"
              iconColor="text-rose-600"
              iconRing="ring-rose-200/60"
              title="รหัสผ่าน &amp; ความปลอดภัย"
              subtitle="เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชีคุณ"
            >
              <form onSubmit={handleChangePassword} className="space-y-4">
                <InsetField
                  id="current-password"
                  label="รหัสผ่านปัจจุบัน"
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={setOldPassword}
                  placeholder="กรอกรหัสผ่านปัจจุบัน"
                  icon={<Lock size={16} aria-hidden="true" />}
                  autoComplete="current-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showOldPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showOldPassword ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  }
                />
                <InsetField
                  id="new-password"
                  label="รหัสผ่านใหม่"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  icon={<KeyRound size={16} aria-hidden="true" />}
                  autoComplete="new-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showNewPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showNewPassword ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  }
                />

                {/* Strength Meter */}
                {newPassword && (
                  <div className="-mt-1 rounded-[18px] bg-[var(--surface-subtle)] p-3.5 ring-1 ring-[var(--hairline)]">
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="text-[var(--ink-muted)]">ระดับความปลอดภัย</span>
                      <span className={`font-bold ${strengthMeta.text}`}>{strengthMeta.label}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full transition-all duration-300 ${strengthMeta.color}`}
                        style={{ width: `${Math.min(100, (passwordStrength / 5) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[var(--ink-muted)]">
                      <span
                        className={newPassword.length >= 8 ? 'text-emerald-600 font-semibold' : ''}
                      >
                        {newPassword.length >= 8 ? '✓' : '○'} อย่างน้อย 8 ตัวอักษร
                      </span>
                      <span
                        className={
                          /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)
                            ? 'text-emerald-600 font-semibold'
                            : ''
                        }
                      >
                        {/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? '✓' : '○'}{' '}
                        พิมพ์เล็ก+ใหญ่
                      </span>
                      <span
                        className={newPassword.length >= 12 ? 'text-emerald-600 font-semibold' : ''}
                      >
                        {newPassword.length >= 12 ? '✓' : '○'} 12 ตัวอักษรขึ้นไป
                      </span>
                      <span
                        className={/\d/.test(newPassword) ? 'text-emerald-600 font-semibold' : ''}
                      >
                        {/\d/.test(newPassword) ? '✓' : '○'} มีตัวเลข
                      </span>
                      <span
                        className={
                          /[^a-zA-Z0-9]/.test(newPassword)
                            ? 'text-emerald-600 font-semibold col-span-2'
                            : 'col-span-2'
                        }
                      >
                        {/[^a-zA-Z0-9]/.test(newPassword) ? '✓' : '○'} มีอักขระพิเศษ (!@#$%)
                      </span>
                    </div>
                  </div>
                )}

                <InsetField
                  id="confirm-new-password"
                  label="ยืนยันรหัสผ่านใหม่"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  icon={<KeyRound size={16} aria-hidden="true" />}
                  autoComplete="new-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  }
                />

                {confirmPassword && (
                  <div
                    className={`-mt-1 flex items-center gap-1.5 rounded-[18px] px-3 py-2 text-[12px] font-semibold ring-1 ${
                      newPassword === confirmPassword
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-rose-50 text-rose-700 ring-rose-200'
                    }`}
                  >
                    {newPassword === confirmPassword ? (
                      <>
                        <Check size={13} /> รหัสผ่านยืนยันตรงกัน
                      </>
                    ) : (
                      <>
                        <Info size={13} /> รหัสผ่านยืนยันยังไม่ตรงกัน
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {isChangingPassword ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                    ) : (
                      <Save size={14} aria-hidden="true" />
                    )}
                    {isChangingPassword ? 'กำลังบันทึก…' : 'อัปเดตรหัสผ่านใหม่'}
                  </button>
                </div>
              </form>
            </SectionCard>
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
            <div hidden={preferenceSection !== 'menu'} className="space-y-5">
              {/* Which pages exist in the sidebar is an admin decision: hiding
                  this card keeps ordinary users from rearranging (or hiding)
                  pages while the workspace is still being built. */}
              <div className={isAdmin ? 'grid gap-5 lg:grid-cols-2' : ''}>
                {isAdmin && (
                  <MainMenuCard items={filteredMenuItems} onMove={moveMainMenuItem} />
                )}
                <QuickLinksCard
                  links={quickLinks}
                  onAdd={openCreateQuickLink}
                  onEdit={openEditQuickLink}
                  onDelete={handleDeleteQuickLink}
                  onMove={handleMoveQuickLink}
                />
              </div>
            </div>

            <div hidden={preferenceSection !== 'appearance'}>
              <ThemeCard />
            </div>

            <div hidden={preferenceSection !== 'alerts'} className="space-y-5">
              <NotificationSettingsCard />
              <DateFormatCard />
            </div>

            <div hidden={preferenceSection !== 'workspace'} className="space-y-5">
              <BrandingCard isAdmin={isAdmin} />
              {/* Company holidays live in general settings, not the admin console:
                  every member can read the calendar, only an admin can change it. */}
              <CompanyHolidayCard canEdit={isAdmin} />
              <WorkspaceBackupCard />
            </div>
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
