'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
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
  SlidersHorizontal,
  Sparkles,
  Star,
  StickyNote,
  Timer,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { WidgetConfig } from '@/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import PullToRefresh from '@/components/Layout/PullToRefresh';
import { getGreeting } from '@/utils/greeting';
import { showConfirm } from '@/utils/sweetalert';
import { usePageHeading } from '@/components/ui/PageHeader';
import GettingStartedCard from '@/components/Onboarding/GettingStartedCard';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import dynamic from 'next/dynamic';
import {
  DashboardPageSkeleton,
  WeatherSkeleton,
  HolidaySkeleton,
  OilPriceSkeleton,
  QRCodeSkeleton,
  QuickNotesSkeleton,
  PriceCalcSkeleton,
  MarketSkeleton,
  ListWidgetSkeleton,
} from '@/components/Widgets/Skeletons';

const OilPriceWidget = dynamic(() => import('@/components/Widgets/OilPriceWidget'), {
  ssr: false,
  loading: () => <OilPriceSkeleton />,
});
const QRCodeWidget = dynamic(() => import('@/components/Widgets/QRCodeWidget'), {
  ssr: false,
  loading: () => <QRCodeSkeleton />,
});
const WeatherWidget = dynamic(() => import('@/components/Widgets/WeatherWidget'), {
  ssr: false,
  loading: () => <WeatherSkeleton />,
});
const HolidayWidget = dynamic(() => import('@/components/Widgets/HolidayWidget'), {
  ssr: false,
  loading: () => <HolidaySkeleton />,
});
const QuickNotesWidget = dynamic(() => import('@/components/Widgets/QuickNotesWidget'), {
  ssr: false,
  loading: () => <QuickNotesSkeleton />,
});
const PriceCalcWidget = dynamic(() => import('@/components/Widgets/PriceCalcWidget'), {
  ssr: false,
  loading: () => <PriceCalcSkeleton />,
});
const MarketWidget = dynamic(() => import('@/components/Widgets/MarketWidget'), {
  ssr: false,
  loading: () => <MarketSkeleton />,
});
const FinanceWidget = dynamic(() => import('@/components/Widgets/FinanceWidget'), {
  ssr: false,
  loading: () => <ListWidgetSkeleton />,
});
const WatchlistWidget = dynamic(() => import('@/components/Widgets/WatchlistWidget'), {
  ssr: false,
  loading: () => <ListWidgetSkeleton />,
});
const CurrencyConverterWidget = dynamic(() => import('@/components/Widgets/CurrencyConverterWidget'), {
  ssr: false,
  loading: () => <ListWidgetSkeleton />,
});
const FocusTimerWidget = dynamic(() => import('@/components/Widgets/FocusTimerWidget'), {
  ssr: false,
  loading: () => <PriceCalcSkeleton />,
});
const CalendarWidget = dynamic(() => import('@/components/Widgets/CalendarWidget'), {
  ssr: false,
  loading: () => <HolidaySkeleton />,
});
const DailyDigestWidget = dynamic(() => import('@/components/Widgets/DailyDigestWidget'), {
  ssr: false,
  loading: () => <WeatherSkeleton />,
});

import { useDashboardLayout, widgetNames, widgetDescriptions, DASHBOARD_VIEWS, VIEW_WIDGET_PRESETS, ROLE_PRESETS } from '@/hooks/useDashboardLayout';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { WIDGET_DESCRIPTION_KEYS, WIDGET_NAME_KEYS } from '@/lib/i18n/messages';

// ── Widget manager metadata ──────────────────────────────────────────────────
// Grouping and icons exist only for the manager dialog: with thirteen widgets a
// flat list forced a long, hard-to-scan scroll. Order here is the order shown.

type WidgetGroupId = 'daily' | 'work' | 'finance';

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

// ── Col-span helper ──────────────────────────────────────────────────────────

const getColSpanClass = (w: number) => {
  if (w === 3) return 'col-span-full';
  if (w === 2) return 'col-span-full md:col-span-8';
  return 'col-span-full md:col-span-6';
};

// ── Inline error fallback ────────────────────────────────────────────────────

function WidgetErrorFallback({
  name,
  error,
  reset,
}: {
  name: string;
  error: Error;
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' || error?.message?.includes('Failed to load chunk');
  return (
    <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100/50">
        <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-[var(--ink)]">วิดเจ็ต {name} ไม่พร้อมใช้งาน</p>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
          {isChunkError
            ? 'มีการอัปเดตเวอร์ชันใหม่ กรุณารีเฟรชหน้าเว็บ'
            : 'ไม่สามารถโหลดข้อมูลวิดเจ็ตนี้ได้ในขณะนี้'}
        </p>
        <button
          onClick={() => {
            if (isChunkError && typeof window !== 'undefined') {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-grouped-2)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-all duration-200 hover:bg-[var(--surface-chip)] active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {isChunkError ? 'รีเฟรชหน้าเว็บ' : 'ลองใหม่อีกครั้ง'}
        </button>
      </div>
    </div>
  );
}

// ── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  widget,
  index,
  onResize,
}: {
  widget: WidgetConfig;
  index: number;
  onResize: (id: string, newWidth: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const { t } = useI18n();
  const widgetLabel = (id: string) =>
    WIDGET_NAME_KEYS[id] ? t(WIDGET_NAME_KEYS[id]) : (widgetNames[id] ?? id);

  const style = {
    transform: CSS.Translate.toString(transform),
    // Only transform is animated (dnd-kit's own transition wins while sorting).
    // `all` used to animate width/height too, which made the card look like it
    // shifted whenever anything inside it changed size.
    transition: transition || (isDragging ? 'none' : 'transform 0.3s ease'),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : 1,
    scale: isDragging ? '0.98' : '1', // Add visual scale down on drag start
  };

  return (
    <div
      ref={setNodeRef}
      data-widget-id={widget.id}
      style={style}
      className={`group relative min-w-0 self-stretch ${getColSpanClass(widget.w)}`}
    >
      <div className="widget-enter h-full" style={{ animationDelay: `${index * 70}ms` }}>
        {/* Drag handle — a slim grip pill centred on the card's top edge. It sits
            in the 4–17px band, above the card's 20px content padding, so it can
            never cover a header control or spill past the widget's border. */}
        <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex justify-center">
          <button
            {...attributes}
            {...listeners}
            type="button"
            aria-label={t('dashboard.moveWidget', { name: widgetLabel(widget.id) })}
            title="ลากเพื่อจัดลำดับ"
            className="pointer-events-auto flex cursor-grab touch-none items-center justify-center rounded-full p-1.5 text-[var(--ink-tertiary)] opacity-0 transition-opacity duration-150 hover:opacity-100 active:cursor-grabbing group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] [@media(hover:none)]:opacity-60"
          >
            <span className="flex h-[13px] w-9 items-center justify-center gap-[3px] rounded-full bg-[var(--surface-chip)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors hover:bg-[var(--surface-chip-2)] hover:text-[var(--ink-muted)]">
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
            </span>
          </button>
        </div>

        {/* Widget content */}
        {widget.id === 'digest' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="สรุปประจำวันอัจฉริยะ" error={err} reset={reset} />
            )}
          >
            <DailyDigestWidget
              width={widget.w}
              onResize={(newSize) => onResize(widget.id, newSize)}
            />
          </ErrorBoundary>
        )}
        {widget.id === 'notes' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="โน้ตด่วน" error={err} reset={reset} />
            )}
          >
            <QuickNotesWidget
              width={widget.w}
              onResize={(newSize) => onResize(widget.id, newSize)}
            />
          </ErrorBoundary>
        )}
        {widget.id === 'calc' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="คิดราคา / กำไร" error={err} reset={reset} />
            )}
          >
            <PriceCalcWidget
              width={widget.w}
              onResize={(newSize) => onResize(widget.id, newSize)}
            />
          </ErrorBoundary>
        )}
        {widget.id === 'focustimer' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="โฟกัส & จับเวลา" error={err} reset={reset} />
            )}
          >
            <FocusTimerWidget
              width={widget.w}
              onResize={(newSize) => onResize(widget.id, newSize)}
            />
          </ErrorBoundary>
        )}
        {widget.id === 'calendar' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="ปฏิทิน & ตารางนัดหมาย" error={err} reset={reset} />
            )}
          >
            <CalendarWidget
              width={widget.w}
              onResize={(newSize) => onResize(widget.id, newSize)}
            />
          </ErrorBoundary>
        )}
        {widget.id === 'market' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="ค่าเงิน · ทอง · SET" error={err} reset={reset} />
            )}
          >
            <MarketWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
        {widget.id === 'holidays' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="วันหยุดนักขัตฤกษ์" error={err} reset={reset} />
            )}
          >
            <HolidayWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
        {widget.id === 'weather' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="สภาพอากาศ" error={err} reset={reset} />
            )}
          >
            <WeatherWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
        {widget.id === 'oilprice' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="ราคาน้ำมัน" error={err} reset={reset} />
            )}
          >
            <OilPriceWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
        {widget.id === 'finance' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="รายรับ – รายจ่าย" error={err} reset={reset} />
            )}
          >
            <FinanceWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
        {widget.id === 'watchlist' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="รายการติดตาม" error={err} reset={reset} />
            )}
          >
            <WatchlistWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
        {widget.id === 'converter' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="แปลงสกุลเงิน" error={err} reset={reset} />
            )}
          >
            <CurrencyConverterWidget
              width={widget.w}
              onResize={(newSize) => onResize(widget.id, newSize)}
            />
          </ErrorBoundary>
        )}
        {widget.id === 'qrcode' && (
          <ErrorBoundary
            fallback={(err, reset) => (
              <WidgetErrorFallback name="QR Code" error={err} reset={reset} />
            )}
          >
            <QRCodeWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

// ── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    widgets,
    visibleWidgetIds,
    isClient,
    user,
    defaultWidgets,
    persistLayout,
    handleResize,
    toggleWidgetVisibility,
    resetToDefaultLayout,
    currentView,
    setCurrentView,
    applyRolePreset,
  } = useDashboardLayout();
  const { t } = useI18n();

  // The greeting is this page's large title; the app header shows the compact
  // "แดชบอร์ด" once it scrolls away.
  const headingRef = usePageHeading(t('page.dashboard.title'));

  // Widget titles and descriptions are translated here so the saved layout keeps
  // its stable ids; the Thai maps stay as the fallback for unknown widgets.
  const widgetLabel = (id: string) =>
    WIDGET_NAME_KEYS[id] ? t(WIDGET_NAME_KEYS[id]) : (widgetNames[id] ?? id);
  const widgetDescription = (id: string) =>
    WIDGET_DESCRIPTION_KEYS[id] ? t(WIDGET_DESCRIPTION_KEYS[id]) : (widgetDescriptions[id] ?? '');

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [greeting, setGreeting] = useState<string>(getGreeting);
  const [widgetQuery, setWidgetQuery] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const normalizedWidgetQuery = widgetQuery.trim().toLowerCase();
  const filteredWidgets = defaultWidgets.filter((widget) => {
    if (widget.id === 'syshealth' && user?.role !== 'admin') return false;
    if (!normalizedWidgetQuery) return true;
    return `${widgetLabel(widget.id)} ${widgetDescription(widget.id)} ${widget.id}`
      .toLowerCase()
      .includes(normalizedWidgetQuery);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'quick-note') {
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder*="โน้ต"], input[placeholder*="พิมพ์โน้ต"], input[aria-label*="โน้ต"]'
        );
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          input.focus();
        }
      }, 400);
    } else if (action === 'oil-prices') {
      setTimeout(() => {
        const oilCard = document.querySelector('[data-widget-id="oilprice"]');
        if (oilCard) {
          oilCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  }, []);

  useEffect(() => {
    setGreeting(getGreeting());
    const timer = setInterval(() => {
      setGreeting(getGreeting());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newLayout = arrayMove(widgets, oldIndex, newIndex);
    persistLayout(newLayout, visibleWidgetIds);
  };

  const viewPreset = VIEW_WIDGET_PRESETS[currentView];
  const visibleWidgets = widgets.filter(
    (w) => visibleWidgetIds.includes(w.id) && (!viewPreset || viewPreset.includes(w.id)),
  );

  // ── Loading state ────────────────────────────────────────────────────────

  if (!user || !isClient) {
    return <DashboardPageSkeleton />;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PullToRefresh>
      {/* ── Apple HIG Hero Welcome Banner ───────────────────────────────── */}
      <section
        aria-label="การทักทายและสถานะประจำวัน"
        className="relative mb-6 overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-7"
      >
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h1
              ref={headingRef}
              className="text-apple-title2 font-semibold text-[var(--ink)] sm:text-apple-title1"
            >
              {greeting},{' '}
              <span className="text-[var(--accent-text)]">{user.display_name || user.username}</span> 👋
            </h1>
            <p className="text-[13px] font-medium text-[var(--ink-muted)]">
              ภาพรวมข้อมูลสำคัญของคุณสำหรับวันนี้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              data-testid="manage-widgets-button"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)] transition-colors duration-150 hover:bg-[var(--surface-grouped)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
              aria-label="จัดการวิดเจ็ต"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--ink-secondary)]" aria-hidden="true" />
              จัดการวิดเจ็ต
            </button>
          </div>
        </div>

        {/* Dashboard View Segmented Pills */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-grouped)] p-1 ring-1 ring-[var(--hairline)]">
            {DASHBOARD_VIEWS.map((v) => {
              const active = currentView === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setCurrentView(v.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-150 active:scale-[0.95] ${
                    active
                      ? 'bg-[var(--surface)] text-[var(--accent-text)] shadow-xs ring-1 ring-[var(--hairline)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <span className="text-[12px] font-medium text-[var(--ink-muted)]">
            แสดง {visibleWidgets.length} วิดเจ็ต
          </span>
        </div>
      </section>

      <GettingStartedCard user={user} />

      {/* ── Widget grid ─────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* No `auto-rows-fr`: that forced every row to match the tallest one
              (the market widget with its chart), stretching the short cards far
              past their content. `items-stretch` still keeps the cards inside a
              single row equal height. */}
          <div className="grid grid-cols-1 items-stretch gap-4 sm:gap-5 md:grid-cols-12">
            {visibleWidgets.map((widget, index) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                index={index}
                onResize={handleResize}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Widget manager modal ─────────────────────────────────────────── */}
      <Dialog
        open={showConfigModal}
        onOpenChange={(open) => {
          setShowConfigModal(open);
          if (!open) {
            setWidgetQuery('');
            setShowPresets(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>การแสดงผลวิดเจ็ต</DialogTitle>
            <DialogDescription>
              เปิดหรือปิดสวิตช์เพื่อจัดการวิดเจ็ตบนแดชบอร์ดหลักของคุณ
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            {/* Sticky search: the list scrolls under it, so finding a widget
                never means scanning the whole set. */}
            <div className="sticky top-0 z-10 -mx-6 -mt-4 bg-[var(--surface)] px-6 pb-2 pt-4">
              <div className="relative">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]"
                />
                <input
                  type="search"
                  value={widgetQuery}
                  onChange={(event) => setWidgetQuery(event.target.value)}
                  placeholder="ค้นหาวิดเจ็ต เช่น น้ำมัน, ปฏิทิน, SET"
                  aria-label="ค้นหาวิดเจ็ต"
                  className="h-10 w-full rounded-[11px] border border-[var(--hairline)] bg-[var(--surface-grouped)] pl-9 pr-9 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-ring)] [&::-webkit-search-cancel-button]:hidden"
                />
                {widgetQuery && (
                  <button
                    type="button"
                    onClick={() => setWidgetQuery('')}
                    aria-label="ล้างคำค้นหา"
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95]"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Role presets stay one tap away but collapsed by default, so the
                widget list gets the modal's height first. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowPresets((open) => !open)}
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
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRolePreset(preset.id)}
                      title={preset.description}
                      className="flex flex-col items-start gap-1 rounded-[11px] border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--surface-grouped)] active:scale-[0.97]"
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
                  ไม่พบวิดเจ็ตที่ตรงกับ “{widgetQuery.trim()}”
                </p>
                <button
                  type="button"
                  onClick={() => setWidgetQuery('')}
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
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                        {group.label}
                      </h3>
                      <span className="text-[11px] tabular-nums text-[var(--ink-tertiary)]">
                        {enabledCount}/{groupWidgets.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                            onClick={() => toggleWidgetVisibility(widget.id)}
                            title={isLocked ? 'ต้องเปิดอย่างน้อย 1 วิดเจ็ต' : undefined}
                            className={`flex items-start gap-2.5 rounded-[14px] border p-3 text-left transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
                              isVisible
                                ? 'border-[var(--accent-border)] bg-[var(--accent-soft-weak)]'
                                : 'border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-grouped)]'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${
                                isVisible
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                                  : 'bg-[var(--surface-grouped)] text-[var(--ink-tertiary)]'
                              }`}
                            >
                              <Icon size={15} />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold leading-tight text-[var(--ink)]">
                                {widgetLabel(widget.id)}
                              </span>
                              <span className="mt-1 block line-clamp-2 text-[11px] leading-snug text-[var(--ink-muted)]">
                                {widgetDescription(widget.id)}
                              </span>
                            </span>

                            {/* The whole card is the switch, so the target is
                                never a 44px hit area in a long list. */}
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

          <DialogFooter className="flex flex-row items-center justify-between">
            <button
              type="button"
              onClick={async () => {
                // Throws away the arrangement the account saved on every device.
                const result = await showConfirm(
                  'รีเซ็ตการจัดเรียงวิดเจ็ต?',
                  'ลำดับ ขนาด และการเปิด/ปิดวิดเจ็ตจะกลับไปเป็นค่าเริ่มต้น',
                );
                if (result.isConfirmed) resetToDefaultLayout();
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold text-[var(--ink-secondary)] transition-all hover:bg-[var(--surface-chip)] active:scale-[0.95]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              รีเซ็ตค่าเริ่มต้น
            </button>
            <button
              onClick={() => setShowConfigModal(false)}
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[var(--accent-hover)]  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.95]"
            >
              เสร็จสิ้น
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PullToRefresh>
  );
}
