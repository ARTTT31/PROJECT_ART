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
  Camera,
  Loader2,
} from 'lucide-react';
import { showDeleteConfirm, showToast, showSuccess, showError } from '@/utils/sweetalert';
import { canAccessPage } from '@/utils/accessiblePages';
import { useAuth } from '@/hooks/useAuth';
import UserManagement from '@/components/Admin/UserManagement';
import { RegistrationPolicyCard } from '@/components/Admin/RegistrationPolicyCard';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { InsetField, SectionCard } from '@/components/Profile/SectionCard';
import { MainMenuCard } from '@/components/Profile/MainMenuCard';
import { QuickLinksCard } from '@/components/Profile/QuickLinksCard';
import { QuickLinkDialog, type QuickLinkFormValues } from '@/components/Profile/QuickLinkDialog';
import { BrandingCard } from '@/components/Profile/BrandingCard';
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

type TabKey = 'profile' | 'preferences' | 'admin';

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, updateUser, logout } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Personal Info Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [quickLinkDialogOpen, setQuickLinkDialogOpen] = useState(false);
  const [editingQuickLink, setEditingQuickLink] = useState<QuickLink | null>(null);

  // Main Menu Config
  const [mainMenuConfig, setMainMenuConfig] = useState<MainMenuItemConfig[]>(() => {
    if (typeof window === 'undefined') return parseMainMenuConfig(null);
    const saved = localStorage.getItem(MAIN_MENU_STORAGE_KEY);
    return parseMainMenuConfig(saved);
  });

  const isAdmin = user?.role === 'admin';

  // Sync the tab with the URL. `?tab=admin` is what the new-sign-up alert
  // email links to, while `#admin` is kept for old bookmarks and manual links.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('tab') || window.location.hash.replace('#', '');
      const tab = requested as TabKey;
      if (tab !== 'profile' && tab !== 'preferences' && tab !== 'admin') return;

      if (tab === 'admin' && authUser?.role !== 'admin') {
        setActiveTab('profile');
        return;
      }
      setActiveTab(tab);
    };

    applyTabFromUrl();
    window.addEventListener('popstate', applyTabFromUrl);
    window.addEventListener('hashchange', applyTabFromUrl);
    return () => {
      window.removeEventListener('popstate', applyTabFromUrl);
      window.removeEventListener('hashchange', applyTabFromUrl);
    };
  }, [authUser]);

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
    localStorage.setItem(MAIN_MENU_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event('art-main-menu-updated'));
    setMainMenuConfig(items);
  };

  const toggleMainMenuItem = (id: string) => {
    const updated = mainMenuConfig.map((item) =>
      item.id === id && !item.required ? { ...item, enabled: !item.enabled } : item,
    );
    saveMainMenu(updated);
  };

  const moveMainMenuItem = (id: string, dir: 'up' | 'down') => {
    const idx = mainMenuConfig.findIndex((item) => item.id === id);
    if (idx === -1) return;
    const newList = [...mainMenuConfig];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= newList.length) return;
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
          const updatedUser: AuthUser = { ...user, avatar: fresh.avatar };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
          updateUser({ avatar: fresh.avatar });
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
        const updatedUser: AuthUser = { ...user, name, email };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        updateUser({ name, email });
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

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0066cc]" />
          <span className="text-[13px] font-medium text-[#6e6e73]">กำลังโหลดข้อมูลโปรไฟล์…</span>
        </div>
      </div>
    );
  }

  const strengthMeta = getStrengthLabel();

  // One shared rule for the whole app — see utils/accessiblePages.ts and the
  // server-side twin in backend/app/api/dependencies.py.
  const filteredMenuItems = mainMenuConfig.filter((item) => canAccessPage(user, item.id));

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-12">
      {/* ══════════════════════════════════════════════════
          HERO IDENTITY CARD (Apple-style Header Banner)
          ══════════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-[18px] bg-white border border-black/[0.06] p-5 sm:p-7 shadow-xs transition-all">
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

              {user.avatar ? (
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-[22px] shadow-md ring-4 ring-black/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.avatar}
                    alt={user.name || 'โปรไฟล์'}
                    className="h-full w-full object-cover"
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-[22px] bg-gradient-to-tr from-[#0066cc] via-[#0077ed] to-[#38bdf8] text-2xl sm:text-3xl font-extrabold text-white shadow-md ring-4 ring-black/[0.03]">
                  {isUploadingAvatar ? (
                    <Loader2 size={24} className="animate-spin text-white" />
                  ) : (
                    user.name?.charAt(0).toUpperCase() || 'U'
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
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-md ring-1 ring-black/[0.08] transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
              >
                <Camera size={13} className="text-[#0066cc]" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1d1d1f] truncate">
                  {user.name || 'ผู้ใช้งาน'}
                </h1>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 ring-1 ring-purple-600/20">
                    <ShieldAlert size={11} /> ผู้ดูแลระบบ (Admin)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-500/20">
                    <User size={11} /> ผู้ใช้ทั่วไป (User)
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#6e6e73]">
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} className="text-[#86868b]" />
                  {user.email || 'ไม่ได้ระบุอีเมล'}
                </span>
                {user.username && (
                  <span className="inline-flex items-center gap-1">
                    <AtSign size={12} className="text-[#86868b]" />
                    {user.username}
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
        className="flex items-center gap-1.5 p-1.5 bg-[#eaebee]/80 backdrop-blur-md rounded-[18px] overflow-x-auto no-scrollbar border border-black/[0.04]"
      >
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
            activeTab === 'profile'
              ? 'bg-white text-[#0066cc] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/50'
          }`}
        >
          <User size={15} />
          <span>ข้อมูลส่วนตัว &amp; ความปลอดภัย</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('preferences')}
          className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
            activeTab === 'preferences'
              ? 'bg-white text-[#0066cc] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/50'
          }`}
        >
          <Sliders size={15} />
          <span>ทางลัด &amp; ปรับแต่งเมนู</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'admin'
                ? 'bg-white text-purple-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/50'
            }`}
          >
            <ShieldAlert
              size={15}
              className={activeTab === 'admin' ? 'text-purple-600' : 'text-[#86868b]'}
            />
            <span>จัดการผู้ใช้งาน</span>
          </button>
        )}
      </nav>

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
            className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start min-h-[480px]"
          >
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[#0071e3] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066cc]"
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
                  <div className="-mt-1 rounded-2xl bg-[#f8fafc] p-3.5 ring-1 ring-black/[0.04]">
                    <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                      <span className="text-[#6e6e73]">ระดับความปลอดภัย</span>
                      <span className={`font-bold ${strengthMeta.text}`}>{strengthMeta.label}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full transition-all duration-300 ${strengthMeta.color}`}
                        style={{ width: `${Math.min(100, (passwordStrength / 5) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#6e6e73]">
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
                    className={`-mt-1 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[11.5px] font-semibold ring-1 ${
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[#0071e3] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066cc]"
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
            className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start min-h-[480px]"
          >
            {/* Which pages exist in the sidebar is an admin decision: hiding
                this card keeps ordinary users from rearranging (or hiding)
                pages while the workspace is still being built. */}
            {isAdmin && (
              <MainMenuCard
                items={filteredMenuItems}
                onToggle={toggleMainMenuItem}
                onMove={moveMainMenuItem}
              />
            )}

            <div className={isAdmin ? undefined : 'lg:col-span-2'}>
              <QuickLinksCard
                links={quickLinks}
                onAdd={openCreateQuickLink}
                onEdit={openEditQuickLink}
                onDelete={handleDeleteQuickLink}
                onMove={handleMoveQuickLink}
              />
            </div>

            <div className="lg:col-span-2">
              <BrandingCard />
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════
          TAB 3: การจัดการผู้ใช้งาน (Admin Panel)
          ══════════════════════════════════════════════════ */}
        {activeTab === 'admin' && isAdmin && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="space-y-4 min-h-[600px]"
          >
            <RegistrationPolicyCard />

            {/* The sign-in page and every account default show the workspace
                branding; personal overrides live on the profile tab. */}
            <BrandingCard scope="workspace" />

            {/* User Management Component */}
            <UserManagement />
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
