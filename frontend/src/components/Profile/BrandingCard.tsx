'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, Check, Loader2, Save, Upload } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { useBranding } from '@/context/BrandingContext';
import { BRAND_PRESETS, type BrandPreset } from '@/lib/brandingPresets';
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
    title: 'ชื่อและโลโก้',
    subtitle: 'ชื่อและโลโก้ที่แสดงเฉพาะบัญชีของคุณ',
    nameLabel: 'ชื่อที่ใช้แสดง',
    namePlaceholder: 'เช่น ทีมของฉัน',
    saveLabel: 'บันทึก',
    savedMessage: 'บันทึกชื่อและโลโก้เรียบร้อยแล้ว',
    resetConfirm: 'ยืนยันการใช้โลโก้เดิมหรือไม่?',
    resetBody: 'โลโก้ที่อัปโหลดไว้จะถูกแทนที่ด้วยโลโก้ของระบบ',
    resetDone: 'กลับไปใช้โลโก้เดิมเรียบร้อยแล้ว',
  },
  workspace: {
    title: 'ชื่อและโลโก้',
    subtitle: 'ใช้ทั้งแถบเมนู หน้าเข้าสู่ระบบ และเป็นค่าเริ่มต้นของทุกบัญชี',
    nameLabel: 'ชื่อที่ใช้แสดง',
    namePlaceholder: 'เช่น ART Workspace หรือ ครอบครัวใจดี',
    saveLabel: 'บันทึก',
    savedMessage: 'บันทึกชื่อและโลโก้เรียบร้อยแล้ว',
    resetConfirm: 'ยืนยันการใช้โลโก้เริ่มต้นของระบบหรือไม่?',
    resetBody: 'โลโก้ที่อัปโหลดไว้จะถูกแทนที่ด้วยโลโก้มาตรฐานของระบบ',
    resetDone: 'กลับไปใช้โลโก้เริ่มต้นเรียบร้อยแล้ว',
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
      showToast('กรุณากรอกชื่อก่อนบันทึก', 'warning');
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

  /**
   * A ready-made preset saves the name, tagline and logo in one request. The
   * logo is a PNG data URL, so it goes through the same fields as a manual
   * upload — no extra endpoint involved.
   */
  const applyPreset = async (preset: BrandPreset) => {
    if (isBusyLogo) return;

    setIsSavingBranding(true);
    const res = isAdmin
      ? await updateBranding({
          company_name: preset.name,
          company_tagline: preset.tagline,
          brand_logo_url: preset.logo,
        })
      : await updateWorkspaceBranding({
          workspace_name: preset.name,
          workspace_tagline: preset.tagline,
          workspace_logo: preset.logo,
        });
    if (res.success && isAdmin) await clearPersonal({ name: true, tagline: true, logo: true });
    setIsSavingBranding(false);

    if (res.success) {
      setFormCompanyName(preset.name);
      setFormCompanyTagline(preset.tagline);
      showSuccess('ใช้ชุดสำเร็จรูปแล้ว', `ตั้งชื่อและโลโก้เป็น “${preset.name}” เรียบร้อย`);
    } else {
      showError('เกิดข้อผิดพลาด', res.error || 'ไม่สามารถบันทึกชุดที่เลือกได้');
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
            <label className="block text-[13px] font-semibold text-[var(--ink)] mb-1.5">
              {copy.nameLabel} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formCompanyName}
              onChange={(e) => setFormCompanyName(e.target.value)}
              placeholder={copy.namePlaceholder}
              disabled={isSavingBranding}
              required
              className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] shadow-2xs placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[var(--ink)] mb-1.5">
              คำโปรย (ไม่บังคับ)
            </label>
            <input
              type="text"
              value={formCompanyTagline}
              onChange={(e) => setFormCompanyTagline(e.target.value)}
              placeholder="เช่น ทำงานให้ง่ายขึ้นทุกวัน"
              disabled={isSavingBranding}
              className="w-full rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] shadow-2xs placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Ready-made name + logo combinations */}
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-subtle)] p-3.5">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
              ชุดชื่อและโลโก้สำเร็จรูป
            </span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">
              เลือกแล้วบันทึกให้ทันที
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BRAND_PRESETS.map((preset) => {
              const active =
                formCompanyName.trim() === preset.name && brandLogoUrl === preset.logo;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  disabled={isBusyLogo}
                  aria-pressed={active}
                  aria-label={`ใช้ชุด ${preset.name}`}
                  className={`flex items-center gap-2 rounded-[12px] border px-2.5 py-2 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-ring)]'
                      : 'border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--hairline-strong)]'
                  }`}
                >
                  <Image
                    src={preset.logo}
                    alt=""
                    width={26}
                    height={26}
                    aria-hidden="true"
                    className="h-[26px] w-[26px] shrink-0 rounded-[8px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--ink)]">
                    {preset.name}
                  </span>
                  {active && (
                    <Check
                      size={13}
                      className="shrink-0 text-[var(--accent-text)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
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
          className={`rounded-xl border bg-[var(--surface-grouped)] p-4 transition-all ${
            isDraggingLogo
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent-ring)]'
              : 'border-[var(--hairline)]'
          }`}
        >
          <span className="text-[11.5px] font-bold text-[var(--ink-tertiary)] uppercase tracking-wider block mb-2">
            ตัวอย่างในเมนูด้านข้าง
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-3 rounded-2xl bg-[var(--glass-95)] p-3 shadow-xs border border-[var(--hairline)] max-w-sm">
              <div className="relative shrink-0">
                <Image
                  src={brandLogoUrl || '/art-workspace-mark.svg'}
                  alt={brandLogoUrl ? 'โลโก้ที่ตั้งไว้' : 'โลโก้เริ่มต้นของระบบ'}
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
                <div className="truncate text-[14px] font-bold text-[var(--ink)]">
                  {formCompanyName.trim() || companyName || 'ชื่อของคุณ'}
                </div>
                <div className="truncate text-[11px] text-[var(--ink-tertiary)]">
                  {formCompanyTagline.trim() || companyTagline || 'พร้อมใช้งาน'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => brandLogoInputRef.current?.click()}
                disabled={isBusyLogo}
                title="PNG, JPG, GIF หรือ WebP ขนาดไม่เกิน 1MB"
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-[11.5px] font-bold text-[var(--ink-secondary)] ring-1 ring-[var(--hairline)] transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                >
                  ใช้โลโก้เดิม
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
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-50"
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
