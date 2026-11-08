'use client';

import { Check, CheckCircle2, Edit, Loader2, ShieldAlert, User, X } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import type { AdminUser } from './userManagementModel';

export default function UserEditPanel({
  user,
  currentUserId,
  role,
  onRoleChange,
  isActive,
  onIsActiveChange,
  isSaving,
  resettingTwoFactorId,
  onSave,
  onCancel,
  onResetTwoFactor,
}: {
  user: AdminUser;
  currentUserId?: number | null;
  role: string;
  onRoleChange: (role: string) => void;
  isActive: boolean;
  onIsActiveChange: (active: boolean) => void;
  isSaving: boolean;
  resettingTwoFactorId: number | null;
  onSave: () => void;
  onCancel: () => void;
  onResetTwoFactor: (user: AdminUser) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-[var(--surface)] ring-1 ring-[var(--hairline)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-6 py-5">
        <div className="flex items-center gap-3 mb-3 sm:mb-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Edit size={18} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
              แก้ไขผู้ใช้งาน: {user.name}
            </h3>
            <p className="text-[13px] text-[var(--ink-muted)]">{user.email || user.username}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          aria-label="ปิดการแก้ไขผู้ใช้"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-chip)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-chip-2)] self-end sm:self-auto"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Status */}
        <div>
          <span className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
            สถานะการใช้งาน
          </span>
          <div className="flex items-center justify-between gap-4 rounded-[18px] bg-[var(--surface-subtle)] p-4 ring-1 ring-[var(--hairline)]">
            <div className="min-w-0">
              <span className="block text-[14px] font-semibold text-[var(--ink)]">
                เปิดใช้งานบัญชี (Active)
              </span>
              <span className="block text-[12px] text-[var(--ink-muted)]">
                ผู้ใช้สามารถเข้าสู่ระบบและใช้งานได้ตามปกติ
              </span>
            </div>
            <Switch checked={isActive} onChange={onIsActiveChange} label="เปิดใช้งานบัญชีนี้" />
          </div>
        </div>

        {/* Two-factor authentication */}
        <div>
          <span className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
            ความปลอดภัย (2FA)
          </span>
          <div className="flex flex-col gap-3 rounded-[18px] bg-[var(--surface-subtle)] p-4 ring-1 ring-[var(--hairline)] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="block text-[14px] font-semibold text-[var(--ink)]">
                {user.two_factor_enabled
                  ? 'เปิดใช้งานการยืนยันสองขั้นตอน'
                  : 'ยังไม่ได้เปิดใช้งาน 2FA'}
              </span>
              <span className="block text-[12px] text-[var(--ink-muted)]">
                {user.two_factor_enabled
                  ? 'ใช้เมื่อผู้ใช้ทำเครื่องและรหัสสำรองหาย — การรีเซ็ตจะล้างรหัสทั้งหมด'
                  : 'บัญชีนี้เข้าสู่ระบบด้วยรหัสผ่านเพียงอย่างเดียว'}
              </span>
            </div>
            {user.two_factor_enabled && (
              <button
                type="button"
                onClick={() => onResetTwoFactor(user)}
                disabled={currentUserId === user.id || resettingTwoFactorId === user.id}
                title={
                  currentUserId === user.id
                    ? 'ปิด 2FA ของตัวเองได้ที่หน้าตั้งค่าความปลอดภัย'
                    : 'ล้างรหัส 2FA ของบัญชีนี้'
                }
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all duration-150 hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resettingTwoFactorId === user.id ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldAlert size={12} aria-hidden="true" />
                )}
                รีเซ็ต 2FA
              </button>
            )}
          </div>
        </div>

        {/* Role */}
        <div>
          <span className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
            สิทธิ์การใช้งาน (Role)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* User Role Card */}
            <div
              onClick={() => onRoleChange('user')}
              className={`group relative flex cursor-pointer items-start gap-3 rounded-[18px] p-4 transition-all duration-200 ${
                role === 'user'
                  ? 'bg-[var(--surface)] ring-2 ring-[var(--accent)]'
                  : 'bg-[var(--surface-subtle)] ring-1 ring-[var(--hairline)] hover:bg-[var(--surface)]'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                  role === 'user'
                    ? 'bg-[var(--accent)] text-white scale-110'
                    : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                }`}
              >
                <User size={18} strokeWidth={2.5} />
              </div>
              <div>
                <span
                  className={`block text-[14px] font-semibold transition-colors ${
                    role === 'user' ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'
                  }`}
                >
                  ผู้ใช้งานทั่วไป (User)
                </span>
                <span className="block mt-0.5 text-[12px] text-[var(--ink-muted)] leading-relaxed">
                  เข้าถึงเฉพาะฟีเจอร์ที่ได้รับอนุญาต
                </span>
              </div>
              {role === 'user' && (
                <div className="absolute right-4 top-4 text-[var(--accent-text)] animate-in zoom-in duration-200">
                  <CheckCircle2 size={20} />
                </div>
              )}
            </div>

            {/* Admin Role Card */}
            <div
              onClick={() => onRoleChange('admin')}
              className={`group relative flex cursor-pointer items-start gap-3 rounded-[18px] p-4 transition-all duration-200 ${
                role === 'admin'
                  ? 'bg-[var(--surface)] ring-2 ring-purple-600'
                  : 'bg-[var(--surface-subtle)] ring-1 ring-[var(--hairline)] hover:bg-[var(--surface)]'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                  role === 'admin'
                    ? 'bg-purple-600 text-white scale-110'
                    : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                }`}
              >
                <ShieldAlert size={18} strokeWidth={2.5} />
              </div>
              <div>
                <span
                  className={`block text-[14px] font-semibold transition-colors ${
                    role === 'admin' ? 'text-purple-700' : 'text-[var(--ink)]'
                  }`}
                >
                  ผู้ดูแลระบบ (Admin)
                </span>
                <span className="block mt-0.5 text-[12px] text-[var(--ink-muted)] leading-relaxed">
                  มีสิทธิ์สูงสุดในการจัดการระบบทั้งหมด
                </span>
              </div>
              {role === 'admin' && (
                <div className="absolute right-4 top-4 text-purple-600 animate-in zoom-in duration-200">
                  <CheckCircle2 size={20} />
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="rounded-[18px] bg-[var(--surface-subtle)] px-4 py-3 text-[12px] leading-relaxed text-[var(--ink-muted)]">
          การเปิด/ปิดหน้าของทั้ง workspace ตั้งค่าได้ที่การ์ด “เปิด/ปิดหน้าใช้งาน”
          ด้านบนของหน้าจัดการระบบ
        </p>
      </div>

      <div className="border-t border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
        <button
          onClick={onCancel}
          className="w-full sm:w-auto rounded-full bg-[var(--surface-grouped)] px-5 py-2.5 text-[13px] font-bold text-[var(--ink)] transition-all hover:bg-[var(--surface-chip-2)] active:scale-[0.95]"
        >
          ยกเลิก
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[var(--accent-hover)]  active:scale-[0.95] disabled:opacity-50"
        >
          {isSaving ? (
            'กำลังบันทึก...'
          ) : (
            <>
              <Check size={14} /> บันทึกการแก้ไข
            </>
          )}
        </button>
      </div>
    </div>
  );
}
