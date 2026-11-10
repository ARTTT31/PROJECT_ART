'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, ChevronDown, Info, Layers, Link2, Palette } from 'lucide-react';
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
  isQuickLinkUrl,
  type QuickLink,
  type QuickLinkEnvironment,
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
  /** Optional alternate destinations (internal tools only). */
  envs?: Partial<Record<QuickLinkEnvironment, string>>;
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
  const [stagingUrl, setStagingUrl] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [iconTab, setIconTab] = useState<'all' | 'general' | 'brand'>('all');
  // The two environment links are optional and used by a minority of links,
  // so they start folded unless this link already has one.
  const [showEnvs, setShowEnvs] = useState(false);

  // Reset the form each time the dialog opens (or the edited link changes).
  useEffect(() => {
    if (!open) return;
    setLabel(link?.label ?? '');
    setUrl(link?.url ?? '');
    setIcon(link?.icon ?? 'link');
    setColor(link?.color || '#0066cc');
    setStagingUrl(link?.envs?.staging ?? '');
    setDevUrl(link?.envs?.development ?? '');
    setShowEnvs(Boolean(link?.envs?.staging || link?.envs?.development));
  }, [open, link]);

  const previewMeta = useMemo(() => describeQuickLink(url), [url]);
  const PreviewIcon = QUICK_LINK_ICON_MAP[icon];
  const previewIconLabel =
    QUICK_LINK_ICON_OPTIONS.find((option) => option.key === icon)?.label ?? 'ลิงก์';

  const filteredOptions = useMemo(() => {
    if (iconTab === 'all') return QUICK_LINK_ICON_OPTIONS;
    return QUICK_LINK_ICON_OPTIONS.filter((option) => option.category === iconTab);
  }, [iconTab]);

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
    if (!isQuickLinkUrl(cleanUrl)) {
      showToast('ลิงก์ต้องขึ้นต้นด้วย http://, https:// หรือ /', 'warning');
      return;
    }

    // Optional alternate destinations. An invalid one is rejected rather than
    // dropped silently, because the user would never notice it disappeared.
    const envs: Partial<Record<QuickLinkEnvironment, string>> = {};
    for (const [key, value] of [
      ['staging', stagingUrl],
      ['development', devUrl],
    ] as Array<[QuickLinkEnvironment, string]>) {
      const clean = value.trim();
      if (!clean) continue;
      if (!isQuickLinkUrl(clean)) {
        showToast(`ลิงก์ ${key} ต้องขึ้นต้นด้วย http://, https:// หรือ /`, 'warning');
        return;
      }
      envs[key] = clean;
    }

    setIsSaving(true);
    const success = await onSubmit({
      label: cleanLabel,
      url: cleanUrl,
      icon,
      color,
      envs: Object.keys(envs).length > 0 ? envs : undefined,
    });
    setIsSaving(false);
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Only the body scrolls: the header and the save buttons stay visible no
          matter how many icon/colour options are on screen. */}
      <DialogContent className="max-w-lg">
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
            {/* Live preview: the row itself is the preview, so it needs no
                wrapper heading taking up height in a scrollable dialog. */}
            <div className="flex items-center gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-grouped)] p-2.5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <PreviewIcon size={17} aria-hidden="true" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold tracking-tight text-[var(--ink)]">
                    {label || 'ชื่อลิงก์ (เช่น Gmail)'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-muted)]">
                    {previewMeta.title}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${
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
              <div className="rounded-[14px] border border-[var(--hairline)]">
                <button
                  type="button"
                  onClick={() => setShowEnvs((shown) => !shown)}
                  aria-expanded={showEnvs}
                  className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-grouped)] active:scale-[0.99]"
                >
                  <Layers size={15} aria-hidden="true" className="text-[var(--ink-tertiary)]" />
                  <span className="flex-1 text-[12px] font-semibold text-[var(--ink-secondary)]">
                    ลิงก์สภาพแวดล้อม (Staging / Dev)
                  </span>
                  <span className="text-[11px] text-[var(--ink-tertiary)]">
                    {stagingUrl.trim() || devUrl.trim() ? 'ตั้งค่าแล้ว' : 'ไม่บังคับ'}
                  </span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`text-[var(--ink-tertiary)] transition-transform duration-200 ${
                      showEnvs ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showEnvs && (
                  <div className="space-y-3 border-t border-[var(--hairline-soft)] p-3">
                    <InsetField
                      id="ql-staging"
                      label="Staging URL"
                      value={stagingUrl}
                      onChange={setStagingUrl}
                      placeholder="https://staging.example.com"
                      icon={<Layers size={16} aria-hidden="true" />}
                    />
                    <InsetField
                      id="ql-dev"
                      label="Dev URL"
                      value={devUrl}
                      onChange={setDevUrl}
                      placeholder="https://dev.example.com"
                      icon={<Layers size={16} aria-hidden="true" />}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Icon Picker (with scroll container and category tabs) */}
            <div>
              <div className="mb-1.5 ml-1 flex items-center justify-between">
                <span className="block text-[11px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">
                  ไอคอน ·{' '}
                  <span className="text-[var(--accent-text)] font-normal normal-case tracking-normal">
                    {previewIconLabel}
                  </span>
                </span>
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIconTab('all')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-all active:scale-[0.95] ${
                      iconTab === 'all'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--surface)] ring-1 ring-[var(--hairline)]'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconTab('general')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-all active:scale-[0.95] ${
                      iconTab === 'general'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--surface)] ring-1 ring-[var(--hairline)]'
                    }`}
                  >
                    ทั่วไป
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconTab('brand')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-all active:scale-[0.95] ${
                      iconTab === 'brand'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--surface)] ring-1 ring-[var(--hairline)]'
                    }`}
                  >
                    แบรนด์/บริการ
                  </button>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-subtle)] p-2">
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {filteredOptions.map((option) => {
                    const OptionIcon = QUICK_LINK_ICON_MAP[option.key];
                    const active = icon === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setIcon(option.key);
                          if (option.brandColor && (!color || color === '#0066cc')) {
                            setColor(option.brandColor);
                          }
                        }}
                        title={option.label}
                        aria-label={option.label}
                        className={[
                          'relative flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-150 active:scale-[0.95]',
                          active
                            ? 'bg-[var(--surface)] shadow-xs ring-2 ring-[var(--accent)]'
                            : 'bg-[var(--glass-60)] hover:bg-[var(--surface)] ring-1 ring-[var(--hairline)] hover:ring-[var(--hairline)]',
                        ].join(' ')}
                      >
                        <OptionIcon
                          size={17}
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
                <span className="text-[11px] font-bold tracking-wide uppercase text-[var(--ink-muted)]">สีของไอคอน</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-4 w-4 rounded-[11px] ring-1 ring-[var(--hairline-strong)]"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-mono text-[var(--ink-muted)] uppercase">{color}</span>
                </div>
              </div>
              <div className="rounded-[18px] bg-[var(--surface-subtle)] p-2.5 ring-1 ring-[var(--hairline)]">
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
                          'h-7 w-7 rounded-[11px] transition-all duration-150 ring-offset-2',
                          active
                            ? 'ring-2 ring-[var(--ink)] scale-110 shadow-xs'
                            : 'ring-1 ring-[var(--hairline-strong)] hover:scale-105',
                        ].join(' ')}
                        style={{ backgroundColor: preset }}
                      />
                    );
                  })}
                  <label className="group relative flex h-7 cursor-pointer items-center justify-center overflow-hidden rounded-[11px] bg-[var(--surface)] text-slate-400 ring-1 ring-[var(--hairline-strong)] transition-all hover:text-slate-600 hover:scale-105 px-2">
                    <Palette size={13} aria-hidden="true" />
                    <span className="ml-1 text-[11px] font-bold">อื่นๆ</span>
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

            {/* Validation hint, condensed to one wrapping line. */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[11px] bg-[var(--surface-grouped)] px-3 py-2 text-[11px] text-[var(--ink-muted)]">
              <Info size={13} className="shrink-0 text-[var(--ink-tertiary)]" aria-hidden="true" />
              <span>รองรับ</span>
              <code className="rounded bg-[var(--surface)] px-1 py-0.5 text-[var(--accent-text)]">
                https://...
              </code>
              <span>สำหรับเว็บภายนอก และ</span>
              <code className="rounded bg-[var(--surface)] px-1 py-0.5 text-[var(--accent-text)]">
                /dashboard
              </code>
              <span>สำหรับหน้าในระบบ</span>
            </div>
          </DialogBody>

          {/* Stacked on phones with the primary action last, so it sits where
              the thumb already is. */}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
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
