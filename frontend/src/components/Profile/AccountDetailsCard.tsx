'use client';

import { useEffect, useState } from 'react';
import { Check, Mail, User } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { showError, showSuccess } from '@/utils/sweetalert';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/types';
import { InsetField, SectionCard } from './SectionCard';

/**
 * "ข้อมูลส่วนตัว" — the name/email form.
 *
 * Split out of the profile page so the account tab is one card with one job;
 * the page only passes the account in and hears about saved changes. The
 * account data export that used to sit under it was removed: workspace backup
 * (`WorkspaceBackupCard`) already downloads the same JSON and can restore it.
 */
export default function AccountDetailsCard({
  user,
  onUpdated,
}: {
  user: AuthUser | null;
  onUpdated: (patch: { name: string; email: string }) => void;
}) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // The session can arrive after the first paint, and a save from another card
  // can rename the account; follow the prop without clobbering what is typed.
  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user?.id, user?.name, user?.email]);

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
        onUpdated({ name, email });
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

  return (
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-auto"
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
  );
}
