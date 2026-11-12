'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, Info, KeyRound, Lock, Save } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { apiMessage } from '@/lib/api/apiMessage';
import { showError, showSuccess, showToast } from '@/utils/sweetalert';
import type { AuthUser } from '@/types';
import { InsetField, SectionCard } from './SectionCard';

/**
 * "รหัสผ่าน & ความปลอดภัย" — the self-service password change.
 *
 * The strength meter and its live checklist live here with the form, so the
 * account tab can stay a thin composition of cards.
 */
export default function PasswordCard({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  const strengthMeta = getStrengthLabel(passwordStrength);

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

  return (
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
          <div className="-mt-1 rounded-apple-lg bg-[var(--surface-subtle)] p-3.5 ring-1 ring-[var(--hairline)]">
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
              <span className={newPassword.length >= 8 ? 'text-emerald-600 font-semibold' : ''}>
                {newPassword.length >= 8 ? '✓' : '○'} อย่างน้อย 8 ตัวอักษร
              </span>
              <span
                className={
                  /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)
                    ? 'text-emerald-600 font-semibold'
                    : ''
                }
              >
                {/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? '✓' : '○'} พิมพ์เล็ก+ใหญ่
              </span>
              <span className={newPassword.length >= 12 ? 'text-emerald-600 font-semibold' : ''}>
                {newPassword.length >= 12 ? '✓' : '○'} 12 ตัวอักษรขึ้นไป
              </span>
              <span className={/\d/.test(newPassword) ? 'text-emerald-600 font-semibold' : ''}>
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
            className={`-mt-1 flex items-center gap-1.5 rounded-apple-lg px-3 py-2 text-[12px] font-semibold ring-1 ${
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
  );
}

function getStrengthLabel(strength: number) {
  if (strength <= 1) return { label: 'อ่อนแอ', color: 'bg-rose-500', text: 'text-rose-700' };
  if (strength === 2) return { label: 'ปานกลาง', color: 'bg-amber-500', text: 'text-amber-700' };
  if (strength === 3) return { label: 'ดี', color: 'bg-lime-500', text: 'text-lime-700' };
  if (strength === 4) return { label: 'แข็งแรง', color: 'bg-emerald-500', text: 'text-emerald-700' };
  return { label: 'ปลอดภัยสูง', color: 'bg-teal-500', text: 'text-teal-700' };
}
