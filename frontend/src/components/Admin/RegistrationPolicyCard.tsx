'use client';

import { useEffect, useState } from 'react';
import { Check, Info, Loader2, Save, UserPlus } from 'lucide-react';
import { SectionCard } from '@/components/Profile/SectionCard';
import { useBranding } from '@/context/BrandingContext';
import { showError, showSuccess } from '@/utils/sweetalert';

const REGISTRATION_OPTIONS = [
  {
    value: 'approval',
    label: 'ต้องรอแอดมินอนุมัติ',
    desc: 'สมัครได้ทันที แต่แอดมินต้องกดอนุมัติก่อนจึงจะเข้าใช้งานได้',
    badge: 'แนะนำ',
  },
  {
    value: 'open',
    label: 'เปิดรับสมัครอิสระ',
    desc: 'สมัครแล้วสามารถเข้าสู่ระบบและเริ่มใช้งานได้ทันที',
  },
  {
    value: 'closed',
    label: 'ปิดรับสมัคร',
    desc: 'ไม่อนุญาตให้บุคคลภายนอกสมัคร (แอดมินต้องสร้างให้เท่านั้น)',
  },
];

/**
 * Sign-up policy for the whole workspace. It lives on the admin tab (not with
 * the branding form) because only an admin may decide who can create an
 * account, and it is saved through the same branding endpoint.
 */
export function RegistrationPolicyCard() {
  const { registrationMode, updateBranding } = useBranding();
  const [mode, setMode] = useState(registrationMode || 'approval');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMode(registrationMode || 'approval');
  }, [registrationMode]);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await updateBranding({ registration_mode: mode });
    setIsSaving(false);
    if (res.success) {
      showSuccess('สำเร็จ', 'บันทึกนโยบายการรับสมัครสมาชิกเรียบร้อยแล้ว!');
    } else {
      showError('เกิดข้อผิดพลาด', res.error || 'ไม่สามารถบันทึกนโยบายได้');
    }
  };

  return (
    <SectionCard
      icon={<UserPlus size={19} aria-hidden="true" />}
      iconBg="bg-indigo-50"
      iconColor="text-indigo-600"
      iconRing="ring-indigo-200/60"
      title="นโยบายการเปิดรับสมาชิกใหม่"
      subtitle="กำหนดว่าใครสมัครเข้าใช้งาน workspace นี้ได้บ้าง"
    >
      <div className="space-y-3">
        <div
          role="radiogroup"
          aria-label="นโยบายการรับสมัครสมาชิก"
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          {REGISTRATION_OPTIONS.map((opt) => {
            const selected = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={isSaving}
                onClick={() => setMode(opt.value)}
                onKeyDown={(event) => {
                  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
                  const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
                  if (!forward && !backward) return;
                  event.preventDefault();
                  const index = REGISTRATION_OPTIONS.findIndex(
                    (option) => option.value === opt.value,
                  );
                  const nextIndex =
                    (index + (forward ? 1 : -1) + REGISTRATION_OPTIONS.length) %
                    REGISTRATION_OPTIONS.length;
                  setMode(REGISTRATION_OPTIONS[nextIndex].value);
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                    .item(nextIndex)
                    ?.focus();
                }}
                className={`flex h-full flex-col rounded-[14px] border p-3.5 text-left transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 ${
                  selected
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft-weak)]'
                    : 'border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-grouped)]'
                }`}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="text-[13px] font-semibold leading-snug text-[var(--ink)]">
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span className="shrink-0 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-text)] ring-1 ring-[var(--hairline)]">
                        {opt.badge}
                      </span>
                    )}
                  </span>

                  {/* Radio mark: the selection reads clearly without a heavy
                      second outline around the whole card. */}
                  <span
                    aria-hidden="true"
                    className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-[var(--hairline-strong)] bg-[var(--surface)]'
                    }`}
                  >
                    {selected && <Check size={11} strokeWidth={3.2} />}
                  </span>
                </span>

                <span className="mt-1.5 block text-[12px] leading-relaxed text-[var(--ink-muted)]">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--ink-tertiary)]">
            <Info size={13} className="shrink-0" aria-hidden="true" />
            มีผลกับหน้าเข้าสู่ระบบของทุกคนทันทีหลังบันทึก
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || mode === (registrationMode || 'approval')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95] disabled:opacity-40 sm:w-auto"
          >
            {isSaving ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={15} aria-hidden="true" />
            )}
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}</span>
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

export default RegistrationPolicyCard;
