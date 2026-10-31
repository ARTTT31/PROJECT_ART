'use client';

import { useEffect, useState } from 'react';
import { Info, Loader2, Save, UserPlus } from 'lucide-react';
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
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {REGISTRATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isSaving}
              onClick={() => setMode(opt.value)}
              className={`flex flex-col rounded-xl border p-3.5 text-left transition-all ${
                mode === opt.value
                  ? 'border-[var(--accent)] bg-[var(--accent-soft-weak)] ring-2 ring-[var(--accent-ring)]'
                  : 'border-[var(--hairline-strong)] bg-[var(--surface)] hover:bg-slate-50'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <div className="mb-1 flex w-full items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-[var(--ink)]">{opt.label}</span>
                {opt.badge && (
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                    {opt.badge}
                  </span>
                )}
              </div>
              <span className="text-[11.5px] leading-relaxed text-[var(--ink-muted)]">{opt.desc}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-tertiary)]">
            <Info size={13} className="shrink-0" aria-hidden="true" />
            มีผลกับหน้าเข้าสู่ระบบของทุกคนทันทีหลังบันทึก
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || mode === (registrationMode || 'approval')}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-40"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}</span>
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

export default RegistrationPolicyCard;
