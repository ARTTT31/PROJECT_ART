'use client';

import { CheckCircle2, ShieldAlert, User, UserPlus, X } from 'lucide-react';
import type { CreateUserForm } from './userManagementModel';

export default function UserCreatePanel({
  form,
  onFormChange,
  isSaving,
  onSave,
  onCancel,
}: {
  form: CreateUserForm;
  onFormChange: (patch: Partial<CreateUserForm>) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-apple-lg bg-[var(--surface)] ring-1 ring-[var(--hairline)]">
      <div className="flex items-center justify-between border-b border-[var(--hairline-soft)] bg-[var(--surface-subtle)] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <UserPlus size={18} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
              สร้างผู้ใช้งานใหม่
            </h3>
            <p className="text-[13px] text-[var(--ink-muted)]">
              บัญชีใช้งานได้ทันทีหลังสร้าง — แจ้งรหัสผ่านให้ผู้ใช้อย่างปลอดภัย
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          aria-label="ปิดฟอร์มสร้างผู้ใช้"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-chip)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-chip-2)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="create-username"
              className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]"
            >
              ชื่อผู้ใช้ (Username) *
            </label>
            <input
              id="create-username"
              value={form.username}
              onChange={(e) => onFormChange({ username: e.target.value })}
              placeholder="อย่างน้อย 3 ตัวอักษร"
              autoComplete="off"
              className="w-full rounded-apple-lg border-0 bg-[var(--surface-subtle)] px-4 py-3 text-[14px] font-medium text-[var(--ink)] outline-hidden ring-1 ring-[var(--hairline)] transition-all placeholder:text-[var(--ink-tertiary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="create-display-name"
              className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]"
            >
              ชื่อที่แสดง (Display name) *
            </label>
            <input
              id="create-display-name"
              value={form.display_name}
              onChange={(e) => onFormChange({ display_name: e.target.value })}
              placeholder="ชื่อ-นามสกุล"
              className="w-full rounded-apple-lg border-0 bg-[var(--surface-subtle)] px-4 py-3 text-[14px] font-medium text-[var(--ink)] outline-hidden ring-1 ring-[var(--hairline)] transition-all placeholder:text-[var(--ink-tertiary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="create-email"
              className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]"
            >
              อีเมล (ไม่บังคับ)
            </label>
            <input
              id="create-email"
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              placeholder="name@example.com"
              autoComplete="off"
              className="w-full rounded-apple-lg border-0 bg-[var(--surface-subtle)] px-4 py-3 text-[14px] font-medium text-[var(--ink)] outline-hidden ring-1 ring-[var(--hairline)] transition-all placeholder:text-[var(--ink-tertiary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label
              htmlFor="create-password"
              className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]"
            >
              รหัสผ่าน *
            </label>
            <input
              id="create-password"
              type="password"
              value={form.password}
              onChange={(e) => onFormChange({ password: e.target.value })}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              autoComplete="new-password"
              className="w-full rounded-apple-lg border-0 bg-[var(--surface-subtle)] px-4 py-3 text-[14px] font-medium text-[var(--ink)] outline-hidden ring-1 ring-[var(--hairline)] transition-all placeholder:text-[var(--ink-tertiary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        <div>
          <span className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
            สิทธิ์การใช้งาน (Role)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['user', 'admin'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onFormChange({ role })}
                aria-pressed={form.role === role}
                className={`group relative flex items-center gap-3 rounded-apple-lg p-4 text-left transition-all duration-200 ${
                  form.role === role
                    ? 'bg-[var(--surface)] ring-2 ring-[var(--accent)]'
                    : 'bg-[var(--surface-subtle)] ring-1 ring-[var(--hairline)] hover:bg-[var(--surface)]'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    form.role === role
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {role === 'admin' ? (
                    <ShieldAlert size={18} strokeWidth={2.5} />
                  ) : (
                    <User size={18} strokeWidth={2.5} />
                  )}
                </div>
                <div>
                  <span className="block text-[14px] font-semibold text-[var(--ink)]">
                    {role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)'}
                  </span>
                  <span className="block mt-0.5 text-[12px] text-[var(--ink-muted)] leading-relaxed">
                    {role === 'admin'
                      ? 'มีสิทธิ์สูงสุดในการจัดการระบบทั้งหมด'
                      : 'เข้าถึงเฉพาะฟีเจอร์ที่ได้รับอนุญาต'}
                  </span>
                </div>
                {form.role === role && (
                  <div className="absolute right-4 top-4 text-[var(--accent-text)]">
                    <CheckCircle2 size={20} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-apple-lg bg-[var(--surface-subtle)] px-4 py-3 text-[12px] leading-relaxed text-[var(--ink-muted)]">
          ผู้ใช้ใหม่จะได้สิทธิ์หน้าตามค่าเริ่มต้นของระบบ —
          การเปิด/ปิดหน้าทั้ง workspace ตั้งค่าได้ที่การ์ด “เปิด/ปิดหน้าใช้งาน”
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
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95] disabled:opacity-50"
        >
          {isSaving ? (
            'กำลังสร้าง...'
          ) : (
            <>
              <UserPlus size={14} /> สร้างผู้ใช้
            </>
          )}
        </button>
      </div>
    </div>
  );
}
