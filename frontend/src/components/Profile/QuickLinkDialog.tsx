'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, Info, Link2, Palette } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { InsetField } from './SectionCard';
import { showToast } from '@/utils/sweetalert';
import {
  QUICK_LINK_ICON_MAP,
  QUICK_LINK_ICON_OPTIONS,
  describeQuickLink,
  isExternalUrl,
  type QuickLink,
  type QuickLinkIconKey,
} from '@/utils/quickLinks';

const QUICK_LINK_COLOR_PRESETS = [
  '#0066cc',
  '#5856d6',
  '#af52de',
  '#ff2d55',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#30b0c7',
  '#8e8e93',
];

export interface QuickLinkFormValues {
  label: string;
  url: string;
  icon: QuickLinkIconKey;
  color: string;
}

interface QuickLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The link being edited, or null when creating a new one. */
  link: QuickLink | null;
  onSubmit: (values: QuickLinkFormValues) => Promise<boolean>;
}

/**
 * Create/edit dialog for a quick link. It owns its form state and validation so
 * the settings page does not have to track five extra fields, and hands the
 * whole set to the page, which owns persistence.
 */
export function QuickLinkDialog({ open, onOpenChange, link, onSubmit }: QuickLinkDialogProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState<QuickLinkIconKey>('link');
  const [color, setColor] = useState('#0066cc');
  const [isSaving, setIsSaving] = useState(false);

  // Reset the form each time the dialog opens (or the edited link changes).
  useEffect(() => {
    if (!open) return;
    setLabel(link?.label ?? '');
    setUrl(link?.url ?? '');
    setIcon(link?.icon ?? 'link');
    setColor(link?.color || '#0066cc');
  }, [open, link]);

  const previewMeta = useMemo(() => describeQuickLink(url), [url]);
  const PreviewIcon = QUICK_LINK_ICON_MAP[icon];
  const previewIconLabel =
    QUICK_LINK_ICON_OPTIONS.find((option) => option.key === icon)?.label ?? 'ลิงก์';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanLabel = label.trim();
    const cleanUrl = url.trim();
    if (!cleanLabel) {
      showToast('กรุณากรอกชื่อควิกลิ้งค์', 'warning');
      return;
    }
    if (!cleanUrl) {
      showToast('กรุณากรอกลิงก์ปลายทาง', 'warning');
      return;
    }
    if (!isExternalUrl(cleanUrl) && !cleanUrl.startsWith('/')) {
      showToast('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ /', 'warning');
      return;
    }

    setIsSaving(true);
    const success = await onSubmit({ label: cleanLabel, url: cleanUrl, icon, color });
    setIsSaving(false);
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{link ? 'แก้ไขควิกลิ้งค์' : 'สร้างควิกลิ้งค์ใหม่'}</DialogTitle>
          <DialogDescription>
            {link
              ? 'ปรับแต่งชื่อ ลิงก์ ไอคอน และสีของลิงก์นี้'
              : 'เพิ่มทางลัดสำหรับเว็บไซต์หรือหน้าที่คุณใช้งานบ่อย'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Preview card */}
            <div className="rounded-[18px] bg-[var(--surface-grouped)] p-3.5 ring-1 ring-black/[0.04]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
                ตัวอย่างการแสดงผล
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--hairline)] shadow-xs">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[14px]"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <PreviewIcon size={17} aria-hidden="true" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold tracking-tight text-[var(--ink)]">
                    {label || 'ชื่อลิงก์ (เช่น Gmail)'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-muted)]">
                    {previewMeta.title}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                    previewMeta.tone === 'ภายนอก'
                      ? 'bg-sky-50 text-sky-700 ring-sky-200'
                      : previewMeta.tone === 'ภายใน'
                        ? 'bg-violet-50 text-violet-700 ring-violet-200'
                        : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}
                >
                  {previewMeta.tone}
                </span>
              </div>
            </div>

            {/* Label + URL */}
            <div className="space-y-3">
              <InsetField
                id="ql-label"
                label="ชื่อลิงก์"
                value={label}
                onChange={setLabel}
                placeholder="เช่น Gmail, งาน IT, Dashboard"
                icon={<Bookmark size={16} aria-hidden="true" />}
                required
              />
              <InsetField
                id="ql-url"
                label="URL / ที่อยู่ลิงก์"
                value={url}
                onChange={setUrl}
                placeholder="https://mail.google.com หรือ /dashboard"
                icon={<Link2 size={16} aria-hidden="true" />}
                required
              />
            </div>

            {/* Icon Picker (with scroll container to avoid huge modal on laptops/phones) */}
            <div>
              <label className="mb-1.5 ml-1 block text-[11px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
                ไอคอน ·{' '}
                <span className="text-[var(--accent-text)] font-normal normal-case tracking-normal">
                  {previewIconLabel}
                </span>
              </label>
              <div className="rounded-2xl bg-[var(--surface-subtle)] p-2 ring-1 ring-black/[0.04] max-h-44 overflow-y-auto">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                  {QUICK_LINK_ICON_OPTIONS.map((option) => {
                    const OptionIcon = QUICK_LINK_ICON_MAP[option.key];
                    const active = icon === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setIcon(option.key)}
                        title={option.label}
                        aria-label={option.label}
                        className={[
                          'relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
                          active
                            ? 'bg-[var(--surface)] shadow-xs ring-2 ring-[var(--accent)]'
                            : 'bg-[var(--glass-60)] hover:bg-[var(--surface)] ring-1 ring-black/[0.04] hover:ring-[var(--hairline)]',
                        ].join(' ')}
                      >
                        <OptionIcon
                          size={15}
                          aria-hidden="true"
                          className={active ? 'text-[var(--accent-text)]' : 'text-slate-500'}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <div className="mb-1.5 ml-1 flex items-center justify-between">
                <label className="text-[11px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
                  สีของไอคอน
                </label>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-4 w-4 rounded-md ring-1 ring-[var(--hairline-strong)]"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-mono text-[var(--ink-muted)] uppercase">{color}</span>
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-subtle)] p-2.5 ring-1 ring-black/[0.04]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_LINK_COLOR_PRESETS.map((preset) => {
                    const active = color === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        aria-label={`สี ${preset}`}
                        className={[
                          'h-7 w-7 rounded-lg transition-all duration-150 ring-offset-2',
                          active
                            ? 'ring-2 ring-[var(--ink)] scale-110 shadow-xs'
                            : 'ring-1 ring-[var(--hairline-strong)] hover:scale-105',
                        ].join(' ')}
                        style={{ backgroundColor: preset }}
                      />
                    );
                  })}
                  <label className="group relative flex h-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[var(--surface)] text-slate-400 ring-1 ring-[var(--hairline-strong)] transition-all hover:text-slate-600 hover:scale-105 px-2">
                    <Palette size={13} aria-hidden="true" />
                    <span className="ml-1 text-[10px] font-bold">อื่นๆ</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label="เลือกสีอื่นๆ"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Validation Hint */}
            <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] text-[var(--ink-muted)] ring-1 ring-slate-200/60 leading-relaxed">
              <Info size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <strong className="font-bold text-[var(--ink-secondary)]">รูปแบบลิงก์ที่รองรับ:</strong>
                <ul className="mt-0.5 ml-3 space-y-0.5 list-disc text-[10.5px]">
                  <li>
                    ภายนอก:{' '}
                    <code className="px-1 py-0.2 rounded bg-[var(--surface)] text-[var(--accent-text)]">https://...</code>
                  </li>
                  <li>
                    ภายใน:{' '}
                    <code className="px-1 py-0.2 rounded bg-[var(--surface)] text-[var(--accent-text)]">/dashboard</code>
                  </li>
                </ul>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto rounded-full bg-[var(--surface-grouped)] px-5 py-2.5 text-[13px] font-bold text-[var(--ink)] transition-all hover:bg-[var(--surface-chip-2)] active:scale-[0.95]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95] disabled:opacity-60"
            >
              <Check size={14} aria-hidden="true" />
              {link ? 'บันทึกการแก้ไข' : 'สร้างลิงก์'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default QuickLinkDialog;
