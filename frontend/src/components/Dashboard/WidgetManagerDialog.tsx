'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarDays,
  CalendarHeart,
  Calculator,
  ChevronDown,
  CloudSun,
  Fuel,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  StickyNote,
  Timer,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { ROLE_PRESETS } from '@/hooks/useDashboardLayout';
import type { WidgetConfig } from '@/types';
import { showConfirm } from '@/utils/sweetalert';

type WidgetGroupId = 'daily' | 'work' | 'finance';

/** Order here is the order the sections appear in the dialog. */
const WIDGET_GROUPS: Array<{ id: WidgetGroupId; label: string }> = [
  { id: 'daily', label: 'ข้อมูลประจำวัน' },
  { id: 'work', label: 'งานและเวลา' },
  { id: 'finance', label: 'การเงิน & ตลาด' },
];

const WIDGET_META: Record<string, { icon: LucideIcon; group: WidgetGroupId }> = {
  digest: { icon: Sparkles, group: 'daily' },
  weather: { icon: CloudSun, group: 'daily' },
  oilprice: { icon: Fuel, group: 'daily' },
  holidays: { icon: CalendarHeart, group: 'daily' },
  notes: { icon: StickyNote, group: 'work' },
  calendar: { icon: CalendarDays, group: 'work' },
  focustimer: { icon: Timer, group: 'work' },
  calc: { icon: Calculator, group: 'work' },
  qrcode: { icon: QrCode, group: 'work' },
  market: { icon: TrendingUp, group: 'finance' },
  finance: { icon: Wallet, group: 'finance' },
  watchlist: { icon: Star, group: 'finance' },
  converter: { icon: ArrowLeftRight, group: 'finance' },
};

export interface WidgetManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: WidgetConfig[];
  visibleWidgetIds: string[];
  onToggle: (id: string) => void;
  onApplyPreset: (presetId: string) => void;
  onReset: () => void;
  /** Translated widget title/description, keyed by widget id. */
  label: (id: string) => string;
  description: (id: string) => string;
}

/**
 * The dashboard's widget manager.
 *
 * Thirteen widgets no longer fit in one flat scroll, so they are grouped by
 * area behind a search box and a collapsible preset list. Each row is a real
 * switch (`role="switch"` on the card itself) so the hit target is the whole
 * tile rather than a 36px track.
 */
export function WidgetManagerDialog({
  open,
  onOpenChange,
  widgets,
  visibleWidgetIds,
  onToggle,
  onApplyPreset,
  onReset,
  label,
  description,
}: WidgetManagerDialogProps) {
  const [query, setQuery] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  // A search typed for one visit should not hide half the widgets next time.
  useEffect(() => {
    if (open) return;
    setQuery('');
    setShowPresets(false);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredWidgets = useMemo(
    () =>
      widgets.filter((widget) => {
        if (!normalizedQuery) return true;
        return `${label(widget.id)} ${description(widget.id)} ${widget.id}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [widgets, normalizedQuery, label, description],
  );

  const handleReset = async () => {
    const result = await showConfirm(
      'รีเซ็ตการจัดเรียงวิดเจ็ต?',
      'ลำดับ ขนาด และการเปิด/ปิดวิดเจ็ตจะกลับไปเป็นค่าเริ่มต้น',
    );
    if (result.isConfirmed) onReset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>การแสดงผลวิดเจ็ต</DialogTitle>
          <DialogDescription>เปิดหรือปิดสวิตช์เพื่อจัดการวิดเจ็ตบนแดชบอร์ดหลักของคุณ</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Sticky search + count: the list scrolls under them, so finding a
              widget never means scanning the whole set. */}
          <div className="sticky top-0 z-10 -mx-6 -mt-4 space-y-1.5 bg-[var(--surface)] px-6 pb-2 pt-4">
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาวิดเจ็ต เช่น น้ำมัน, ปฏิทิน, SET"
                aria-label="ค้นหาวิดเจ็ต"
                className="h-10 w-full rounded-[11px] border border-[var(--hairline)] bg-[var(--surface-grouped)] pl-9 pr-9 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)] [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95]"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="px-1 text-[11px] text-[var(--ink-tertiary)]">
              เปิดใช้งาน {visibleWidgetIds.length} จาก {widgets.length} วิดเจ็ต
              {normalizedQuery && ` · พบ ${filteredWidgets.length} รายการ`}
            </p>
          </div>

          {/* Presets stay one tap away but folded, so the list gets the height. */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPresets((shown) => !shown)}
              aria-expanded={showPresets}
              className="flex w-full items-center gap-2 rounded-[11px] border border-[var(--hairline)] bg-[var(--surface-grouped)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-chip)] active:scale-[0.99]"
            >
              <Sparkles size={15} aria-hidden="true" className="text-[var(--accent-text)]" />
              <span className="flex-1 text-[12px] font-semibold text-[var(--ink-secondary)]">
                แม่แบบจัดหน้าตามสายงาน
              </span>
              <span className="text-[11px] text-[var(--ink-tertiary)]">
                {ROLE_PRESETS.length} แบบ
              </span>
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={`text-[var(--ink-tertiary)] transition-transform duration-200 ${
                  showPresets ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showPresets && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyPreset(preset.id)}
                    title={preset.description}
                    className="flex flex-col items-start gap-1 rounded-[11px]! border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--surface-grouped)] active:scale-[0.97]"
                  >
                    <span className="text-[12px] font-bold text-[var(--ink)]">{preset.label}</span>
                    <span className="line-clamp-1 text-[10px] text-[var(--ink-muted)]">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredWidgets.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[var(--hairline-strong)] px-4 py-8 text-center">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                ไม่พบวิดเจ็ตที่ตรงกับ “{query.trim()}”
              </p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-2 text-[12px] font-semibold text-[var(--accent-text)] active:scale-[0.95]"
              >
                ล้างคำค้นหา
              </button>
            </div>
          ) : (
            WIDGET_GROUPS.map((group) => {
              const groupWidgets = filteredWidgets.filter(
                (widget) => (WIDGET_META[widget.id]?.group ?? 'work') === group.id,
              );
              if (groupWidgets.length === 0) return null;
              const enabledCount = groupWidgets.filter((widget) =>
                visibleWidgetIds.includes(widget.id),
              ).length;

              return (
                <section key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                      {group.label}
                    </h3>
                    <span className="text-[11px] tabular-nums text-[var(--ink-tertiary)]">
                      {enabledCount}/{groupWidgets.length}
                    </span>
                  </div>

                  <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
                    {groupWidgets.map((widget) => {
                      const isVisible = visibleWidgetIds.includes(widget.id);
                      const isLocked = isVisible && visibleWidgetIds.length <= 1;
                      const Icon = WIDGET_META[widget.id]?.icon ?? Sparkles;

                      return (
                        <button
                          key={widget.id}
                          type="button"
                          role="switch"
                          aria-checked={isVisible}
                          disabled={isLocked}
                          onClick={() => onToggle(widget.id)}
                          title={
                            isLocked ? 'ต้องเปิดอย่างน้อย 1 วิดเจ็ต' : description(widget.id)
                          }
                          // `!` on the radius because globals.css forces every
                          // button into a pill; these are cards, not buttons.
                          className={`flex h-full min-h-[76px] items-start gap-3 overflow-hidden rounded-[14px]! border p-3.5 text-left transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
                            isVisible
                              ? 'border-[var(--accent-border)] bg-[var(--accent-soft-weak)]'
                              : 'border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-grouped)]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
                              isVisible
                                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                                : 'bg-[var(--surface-grouped)] text-[var(--ink-tertiary)]'
                            }`}
                          >
                            <Icon size={16} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-[13px] font-semibold leading-snug text-[var(--ink)]">
                              {label(widget.id)}
                            </span>
                            <span className="mt-1 block line-clamp-2 break-words text-[11px] leading-snug text-[var(--ink-muted)]">
                              {description(widget.id)}
                            </span>
                          </span>

                          {/* The whole card is the switch, so the target is never
                              a 36px hit area in a long list. */}
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 flex h-[22px] w-[36px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                              isVisible ? 'bg-[var(--accent)]' : 'bg-[var(--surface-chip)]'
                            }`}
                          >
                            <span
                              className={`h-[18px] w-[18px] rounded-full bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ${
                                isVisible ? 'translate-x-[14px]' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </DialogBody>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-chip)] active:scale-[0.95] sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            รีเซ็ตค่าเริ่มต้น
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95] sm:w-auto"
          >
            เสร็จสิ้น
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WidgetManagerDialog;
