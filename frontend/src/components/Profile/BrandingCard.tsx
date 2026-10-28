'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, Loader2, Save, Upload } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { useBranding } from '@/context/BrandingContext';
import { showConfirm, showError, showSuccess, showToast } from '@/utils/sweetalert';

const MAX_LOGO_BYTES = 1 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_LOGO_ATTR = ACCEPTED_LOGO_TYPES.join(',');

/** Mirrors the validation the upload endpoint applies, so the user gets the
 *  message before a pointless round-trip. */
function validateLogoFile(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return 'ขนาดไฟล์รูปภาพห้ามเกิน 1MB';
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    return 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, GIF, WebP เท่านั้น (ไม่รองรับ SVG)';
  }
  return null;
}

const COPY = {
  personal: {
    title: 'ชื่อทีมและโลโก้',
    subtitle: 'ชื่อและโลโก้ที่แสดงเฉพาะบัญชีของคุณ',
    nameLabel: 'ชื่อทีม / บริษัท / ครอบครัว',
    namePlaceholder: 'เช่น ทีมส่วนตัวของฉัน',
    saveLabel: 'บันทึกชื่อทีมและโลโก้',
    savedMessage: 'บันทึกชื่อทีมและโลโก้ของคุณเรียบร้อยแล้ว!',
    resetConfirm: 'กลับไปใช้โลโก้ของ workspace?',
    resetBody: 'โลโก้ที่คุณอัปโหลดไว้จะถูกแทนที่ด้วยโลโก้ส่วนกลางของระบบ',
    resetDone: 'รีเซ็ตโลโก้กลับเป็นค่าเริ่มต้นแล้ว',
  },
  workspace: {
    title: 'ชื่อทีมและโลโก้',
    subtitle: 'ชื่อและโลโก้ของทีม ใช้ทั้งแถบเมนู หน้าเข้าสู่ระบบ และเป็นค่าเริ่มต้นของทุกบัญชี',
    nameLabel: 'ชื่อทีม / บริษัท / ครอบครัว',
    namePlaceholder: 'เช่น ทีม Dev ART หรือ ครอบครัวใจดี',
    saveLabel: 'บันทึกชื่อทีมและโลโก้',
    savedMessage: 'บันทึกชื่อทีมและโลโก้เรียบร้อยแล้ว!',
    resetConfirm: 'กลับไปใช้โลโก้เริ่มต้นของระบบ?',
    resetBody: 'โลโก้ที่อัปโหลดไว้จะถูกแทนที่ด้วยโลโก้มาตรฐานของระบบ',
    resetDone: 'รีเซ็ตโลโก้กลับเป็นค่าเริ่มต้นแล้ว',
  },
} as const;

/**
 * Workspace branding card — one card for everyone.
 *
 * An ordinary account edits its own name/tagline/logo, which only changes what
 * that account sees. An admin edits the workspace-wide branding instead, so the
 * sidebar, the sign-in page and the default for new accounts all follow from
 * this single card.
 */
export function BrandingCard({ isAdmin = false }: { isAdmin?: boolean }) {
  const {
    companyName,
    companyTagline,
    brandLogoUrl,
    workspaceName,
    workspaceTagline,
    workspaceLogo,
    updateBranding,
    uploadBrandLogo,
    updateWorkspaceBranding,
    uploadWorkspaceLogo,
  } = useBranding();

  const copy = isAdmin ? COPY.workspace : COPY.personal;
  const initialName = isAdmin ? companyName : workspaceName;
  const initialTagline = isAdmin ? companyTagline : workspaceTagline;

  // An admin edit goes to the workspace branding, so a leftover personal
  // override from an earlier session has to be cleared or it would keep
  // shadowing the new value in this account's own sidebar.
  const clearPersonal = async (fields: { name?: boolean; tagline?: boolean; logo?: boolean }) => {
    const payload: {
      workspace_name?: string;
      workspace_tagline?: string;
      workspace_logo?: string;
    } = {};
    if (fields.name && workspaceName) payload.workspace_name = '';
    if (fields.tagline && workspaceTagline) payload.workspace_tagline = '';
    if (fields.logo && workspaceLogo) payload.workspace_logo = '';
    if (Object.keys(payload).length > 0) await updateWorkspaceBranding(payload);
  };

  const [formCompanyName, setFormCompanyName] = useState(initialName);
  const [formCompanyTagline, setFormCompanyTagline] = useState(initialTagline);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBrandLogo, setIsUploadingBrandLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  useEffect(() => {
    setFormCompanyName(initialName);
    setFormCompanyTagline(initialTagline);
  }, [initialName, initialTagline]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formCompanyName.trim();
    if (!name) {
      showToast('กรุณากรอกชื่อทีมหรือองค์กร', 'warning');
      return;
    }

    setIsSavingBranding(true);
    // The logo has its own immediate-save flow; sending it here would re-upload
    // a 20–40KB data URL on every name change.
    const res = isAdmin
      ? await updateBranding({
          company_name: name,
          company_tagline: formCompanyTagline.trim(),
        })
      : await updateWorkspaceBranding({
          workspace_name: name,
          workspace_tagline: formCompanyTagline.trim(),
        });
    if (res.success && isAdmin) await clearPersonal({ name: true, tagline: true });
    setIsSavingBranding(false);

    if (res.success) {
      showSuccess('สำเร็จ', copy.savedMessage);
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
    const res = isAdmin ? await uploadBrandLogo(file) : await uploadWorkspaceLogo(file);
    if (res.success && isAdmin) await clearPersonal({ logo: true });
    setIsUploadingBrandLogo(false);
    if (brandLogoInputRef.current) brandLogoInputRef.current.value = '';

    if (res.success) {
      showSuccess('สำเร็จ', 'เปลี่ยนโลโก้เรียบร้อยแล้ว!');
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
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadLogoFile(file);
  };

  const handleResetBrandLogo = async () => {
    const confirmed = await showConfirm(copy.resetConfirm, copy.resetBody);
    if (!confirmed.isConfirmed) return;

    setIsUploadingBrandLogo(true);
    const res = isAdmin
      ? await updateBranding({ brand_logo_url: '' })
      : await updateWorkspaceBranding({ workspace_logo: '' });
    if (res.success && isAdmin) await clearPersonal({ logo: true });
    setIsUploadingBrandLogo(false);

    if (res.success) {
      showSuccess('สำเร็จ', copy.resetDone);
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
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <form onSubmit={handleSaveBranding} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              {copy.nameLabel} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formCompanyName}
              onChange={(e) => setFormCompanyName(e.target.value)}
              placeholder={copy.namePlaceholder}
              disabled={isSavingBranding}
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
              disabled={isSavingBranding}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-[#1d1d1f] shadow-2xs placeholder:text-[#86868b] focus:border-[#0066cc] focus:outline-hidden focus:ring-2 focus:ring-[#0066cc]/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Logo + Live Preview Box */}
        <div
          onDragOver={(e) => {
            // Always swallow the drop so dragging a file onto the card does not
            // navigate the tab to that file.
            e.preventDefault();
            setIsDraggingLogo(true);
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
                  {formCompanyName.trim() || companyName || 'ชื่อทีมของคุณ'}
                </div>
                <div className="truncate text-[11px] text-[#86868b]">
                  {formCompanyTagline.trim() || companyTagline || 'Workspace'}
                </div>
              </div>
            </div>

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
          </div>

          <input
            ref={brandLogoInputRef}
            type="file"
            accept={ACCEPTED_LOGO_ATTR}
            onChange={handleLogoFileSelect}
            className="hidden"
            aria-label="เลือกรูปโลโก้ของทีม"
          />
        </div>

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
                <span>{copy.saveLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

export default BrandingCard;
