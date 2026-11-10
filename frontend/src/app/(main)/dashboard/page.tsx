'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { WidgetConfig } from '@/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import PullToRefresh from '@/components/Layout/PullToRefresh';
import { getGreeting } from '@/utils/greeting';
import { usePageHeading } from '@/components/ui/PageHeader';
import GettingStartedCard from '@/components/Onboarding/GettingStartedCard';
import WidgetManagerDialog from '@/components/Dashboard/WidgetManagerDialog';

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

import { useDashboardLayout, widgetNames, widgetDescriptions, DASHBOARD_VIEWS, VIEW_WIDGET_PRESETS } from '@/hooks/useDashboardLayout';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { WIDGET_DESCRIPTION_KEYS, WIDGET_NAME_KEYS } from '@/lib/i18n/messages';

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
      <WidgetManagerDialog
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        widgets={defaultWidgets}
        visibleWidgetIds={visibleWidgetIds}
        onToggle={toggleWidgetVisibility}
        onApplyPreset={applyRolePreset}
        onReset={resetToDefaultLayout}
        label={widgetLabel}
        description={widgetDescription}
      />    </PullToRefresh>
  );
}
