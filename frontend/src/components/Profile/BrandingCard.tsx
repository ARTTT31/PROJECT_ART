'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, Info, Loader2, Save, Upload } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { useBranding } from '@/context/BrandingContext';
import { showConfirm, showError, showSuccess, showToast } from '@/utils/sweetalert';

const MAX_LOGO_BYTES = 1 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_LOGO_ATTR = ACCEPTED_LOGO_TYPES.join(',');

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

/** Mirrors the validation the upload endpoint applies, so the user gets the
 *  message before a pointless round-trip. */
function validateLogoFile(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return 'ขนาดไฟล์รูปภาพห้ามเกิน 1MB';
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    return 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, GIF, WebP เท่านั้น (ไม่รองรับ SVG)';
  }
  return null;
}

/**
 * "ชื่อทีม / ครอบครัว / องค์กร (Workspace Branding)" card. It owns the form and
 * the logo upload flow; the branding context keeps the rest of the app (sidebar,
 * login, favicon) in sync.
 */
export function BrandingCard({ isAdmin }: { isAdmin: boolean }) {
  const {
    companyName,
    companyTagline,
    brandLogoUrl,
    registrationMode,
    updateBranding,
    uploadBrandLogo,
  } = useBranding();

  const [formCompanyName, setFormCompanyName] = useState(companyName);
  const [formCompanyTagline, setFormCompanyTagline] = useState(companyTagline);
  const [formRegistrationMode, setFormRegistrationMode] = useState(registrationMode || 'approval');
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBrandLogo, setIsUploadingBrandLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  useEffect(() => {
    setFormCompanyName(companyName);
    setFormCompanyTagline(companyTagline);
    setFormRegistrationMode(registrationMode || 'approval');
  }, [companyName, companyTagline, registrationMode]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompanyName.trim()) {
      showToast('กรุณากรอกชื่อทีมหรือองค์กร', 'warning');
      return;
    }
    setIsSavingBranding(true);
    // No brand_logo_url here: the API keeps the stored logo when the field is
    // absent, so saving the name does not re-upload (or clear) it.
    const res = await updateBranding({
      company_name: formCompanyName.trim(),
      company_tagline: formCompanyTagline.trim(),
      registration_mode: formRegistrationMode,
    });
    setIsSavingBranding(false);
    if (res.success) {
      showSuccess('สำเร็จ', 'บันทึกชื่อทีมและนโยบายการใช้งานเรียบร้อยแล้ว!');
    } else {
      showError('เกิดข้อผิดพลาด', res.error || 'ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const uploadLogoFile = async (file: File) => {
    const problem = validateLogoFile(file);
    if (problem) {
      showToast(problem, 'warning');
      return;
    }

    setIsUploadingBrandLogo(true);
    const res = await uploadBrandLogo(file);
    setIsUploadingBrandLogo(false);
    if (brandLogoInputRef.current) brandLogoInputRef.current.value = '';

    if (res.success) {
      showSuccess('สำเร็จ', 'เปลี่ยนโลโก้ของทีมเรียบร้อยแล้ว!');
    } else {
      showError('อัปโหลดไม่สำเร็จ', res.error || 'ไม่สามารถอัปโหลดโลโก้ได้');
    }
  };

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  };

  const handleLogoDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (!isAdmin) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadLogoFile(file);
  };

  const handleResetBrandLogo = async () => {
    const confirmed = await showConfirm(
      'กลับไปใช้โลโก้เริ่มต้น?',
      'โลโก้ที่อัปโหลดไว้จะถูกแทนที่ด้วยโลโก้มาตรฐานของระบบ',
    );
    if (!confirmed.isConfirmed) return;

    setIsUploadingBrandLogo(true);
    const res = await updateBranding({ brand_logo_url: '' });
    setIsUploadingBrandLogo(false);

    if (res.success) {
      showSuccess('สำเร็จ', 'รีเซ็ตโลโก้กลับเป็นค่าเริ่มต้นแล้ว');
    } else {
      showError('เกิดข้อผิดพลาด', res.error || 'ไม่สามารถรีเซ็ตโลโก้ได้');
    }
  };

  const isBusyLogo = isUploadingBrandLogo || isSavingBranding;

  return (
    <SectionCard
      icon={<Building2 size={19} aria-hidden="true" />}
      iconBg="bg-amber-50"
      iconColor="text-amber-600"
      iconRing="ring-amber-200/60"
      title="ชื่อทีมและโลโก้"
      subtitle="ตั้งชื่อทีมและโลโก้ ที่ใช้แสดงในเมนูด้านข้าง หน้าเข้าสู่ระบบ และไอคอนแท็บ"
      badge={isAdmin ? 'เฉพาะแอดมิน' : 'อ่านอย่างเดียว'}
    >
      <form onSubmit={handleSaveBranding} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              ชื่อทีม / บริษัท / ครอบครัว <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formCompanyName}
              onChange={(e) => setFormCompanyName(e.target.value)}
              placeholder="เช่น ทีม Dev ART หรือ ครอบครัวใจดี"
              disabled={!isAdmin || isSavingBranding}
              required
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-[#1d1d1f] shadow-2xs placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              สโลแกนหรือคำโปรย (Tagline)
            </label>
            <input
              type="text"
              value={formCompanyTagline}
              onChange={(e) => setFormCompanyTagline(e.target.value)}
              placeholder="เช่น ศูนย์รวมเครื่องมือและการทำงานส่วนกลาง"
              disabled={!isAdmin || isSavingBranding}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-[#1d1d1f] shadow-2xs placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Registration Mode Selector */}
        <div>
          <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
            นโยบายการเปิดรับสมาชิกใหม่ (Registration Policy)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {REGISTRATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={!isAdmin || isSavingBranding}
                onClick={() => setFormRegistrationMode(opt.value)}
                className={`flex flex-col p-3.5 rounded-xl border text-left transition-all relative ${
                  formRegistrationMode === opt.value
                    ? 'border-[#0066cc] bg-[#0066cc]/[0.04] ring-2 ring-[#0066cc]/20'
                    : 'border-black/10 bg-white hover:bg-slate-50'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[13px] font-bold text-[#1d1d1f]">{opt.label}</span>
                  {opt.badge && (
                    <span className="rounded-full bg-blue-100 text-[#0066cc] px-2 py-0.5 text-[10px] font-bold">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11.5px] text-[#6e6e73] leading-relaxed">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Logo + Live Preview Box */}
        <div
          onDragOver={(e) => {
            // Always swallow the drop so a non-admin dragging a file onto the
            // card does not navigate the tab to that file.
            e.preventDefault();
            if (isAdmin) setIsDraggingLogo(true);
          }}
          onDragLeave={() => setIsDraggingLogo(false)}
          onDrop={handleLogoDrop}
          className={`rounded-xl border bg-[#f5f5f7]/60 p-4 transition-all ${
            isDraggingLogo
              ? 'border-[#0066cc] bg-[#0066cc]/[0.06] ring-2 ring-[#0066cc]/30'
              : 'border-black/[0.06]'
          }`}
        >
          <span className="text-[11.5px] font-bold text-[#86868b] uppercase tracking-wider block mb-2">
            โลโก้และตัวอย่างในเมนูด้านข้าง
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-3 rounded-2xl bg-white/90 p-3 shadow-xs border border-black/[0.06] max-w-sm">
              <div className="relative shrink-0">
                <Image
                  src={brandLogoUrl || '/art-workspace-mark.svg'}
                  alt={brandLogoUrl ? 'โลโก้ของทีม' : 'โลโก้เริ่มต้นของระบบ'}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl object-contain"
                />
                {isUploadingBrandLogo && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                    <Loader2 size={14} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold text-[#1d1d1f]">
                  {formCompanyName.trim() || 'ชื่อทีมของคุณ'}
                </div>
                <div className="truncate text-[11px] text-[#86868b]">
                  {formCompanyTagline.trim() || 'Workspace'}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => brandLogoInputRef.current?.click()}
                  disabled={isBusyLogo}
                  title="PNG, JPG, GIF หรือ WebP ขนาดไม่เกิน 1MB"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0066cc] px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-xs transition-all hover:bg-[#0071e3] active:scale-95 disabled:opacity-50"
                >
                  {isUploadingBrandLogo ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload size={13} aria-hidden="true" />
                  )}
                  {isUploadingBrandLogo
                    ? 'กำลังอัปโหลด...'
                    : brandLogoUrl
                      ? 'เปลี่ยนโลโก้'
                      : 'อัปโหลดโลโก้'}
                </button>
                {brandLogoUrl && (
                  <button
                    type="button"
                    onClick={handleResetBrandLogo}
                    disabled={isBusyLogo}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-[#475569] ring-1 ring-black/[0.08] transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                  >
                    ใช้โลโก้เริ่มต้น
                  </button>
                )}
              </div>
            )}
          </div>

          {isAdmin && (
            <input
              ref={brandLogoInputRef}
              type="file"
              accept={ACCEPTED_LOGO_ATTR}
              onChange={handleLogoFileSelect}
              className="hidden"
              aria-label="เลือกรูปโลโก้ของทีม"
            />
          )}
        </div>

        {isAdmin ? (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingBranding}
              className="inline-flex items-center gap-2 rounded-full bg-[#0066cc] px-5 py-2 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-[#0071e3] active:scale-95 disabled:opacity-50"
            >
              {isSavingBranding ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>บันทึกชื่อทีมและแบรนด์</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-[#86868b] flex items-center gap-1.5 pt-1">
            <Info size={14} className="shrink-0 text-[#86868b]" />
            เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเปลี่ยนชื่อและข้อมูลแบรนด์ส่วนกลางได้
          </p>
        )}
      </form>
    </SectionCard>
  );
}

export default BrandingCard;
