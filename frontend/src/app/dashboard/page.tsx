'use client'

import { useState } from 'react'
import { GripHorizontal, SlidersHorizontal } from 'lucide-react'
import { WidgetConfig } from '@/types'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import ErrorBoundary from '@/components/ErrorBoundary'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'สวัสดีตอนเช้า'
  if (hour >= 12 && hour < 17) return 'สวัสดีตอนบ่าย'
  if (hour >= 17 && hour < 21) return 'สวัสดีตอนเย็น'
  return 'ราตรีสวัสดิ์'
}

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import dynamic from 'next/dynamic'

const OilPriceWidget = dynamic(() => import('@/components/Widgets/OilPriceWidget'), { ssr: false, loading: () => <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse min-h-[200px]" /> })
const QRCodeWidget = dynamic(() => import('@/components/Widgets/QRCodeWidget'), { ssr: false, loading: () => <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse min-h-[200px]" /> })
const WeatherWidget = dynamic(() => import('@/components/Widgets/WeatherWidget'), { ssr: false, loading: () => <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse min-h-[200px]" /> })
const HolidayWidget = dynamic(() => import('@/components/Widgets/HolidayWidget'), { ssr: false, loading: () => <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse min-h-[200px]" /> })

import { useDashboardLayout, widgetNames, widgetDescriptions } from '@/hooks/useDashboardLayout'

// ── Col-span helper ──────────────────────────────────────────────────────────

const getColSpanClass = (w: number) => {
  if (w === 3) return 'col-span-full'
  if (w === 2) return 'col-span-full md:col-span-8'
  return 'col-span-full md:col-span-6'
}

// ── Inline error fallback ────────────────────────────────────────────────────

function WidgetErrorFallback({ name, error, reset }: { name: string; error: Error; reset: () => void }) {
  const isChunkError = error?.name === 'ChunkLoadError' || error?.message?.includes('Failed to load chunk')
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl bg-[#fff0f0] p-6 ring-1 ring-red-100">
      <div className="text-center">
        <p className="text-sm font-bold text-red-700">วิดเจ็ต{name} โหลดไม่สำเร็จ</p>
        <p className="mt-1 text-xs text-red-500/80">
          {isChunkError ? 'มีการอัปเดตเวอร์ชันใหม่ กรุณารีเฟรชหน้าเว็บ' : error.message}
        </p>
        <button
          onClick={() => {
            if (isChunkError && typeof window !== 'undefined') {
              window.location.reload()
            } else {
              reset()
            }
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          {isChunkError ? 'รีเฟรชหน้าเว็บ' : 'ลองใหม่'}
        </button>
      </div>
    </div>
  )
}

// ── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  widget,
  onResize,
}: {
  widget: WidgetConfig
  onResize: (id: string, newWidth: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: transition || (isDragging ? 'none' : 'all 0.3s ease'),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : 1,
    scale: isDragging ? '0.98' : '1', // Add visual scale down on drag start
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${getColSpanClass(widget.w)}`}
    >
      {/* Drag handle — visible on hover, sits above widget */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-x-0 top-0 z-10 flex h-10 cursor-grab items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 active:cursor-grabbing touch-none"
        aria-label={`ย้ายวิดเจ็ต ${widgetNames[widget.id]}`}
      >
        <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 shadow-md ring-1 ring-black/[0.08] backdrop-blur-md">
          <GripHorizontal className="h-3.5 w-3.5 text-[#6e6e73]" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-[#6e6e73]">จัดลำดับ</span>
        </span>
      </div>

      {/* Widget content */}
      {widget.id === 'holidays' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="วันหยุดนักขัตฤกษ์" error={err} reset={reset} />}>
          <HolidayWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
        </ErrorBoundary>
      )}
      {widget.id === 'weather' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="สภาพอากาศ" error={err} reset={reset} />}>
          <WeatherWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
        </ErrorBoundary>
      )}
      {widget.id === 'oilprice' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="ราคาน้ำมัน" error={err} reset={reset} />}>
          <OilPriceWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
        </ErrorBoundary>
      )}
      {widget.id === 'qrcode' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="QR Code" error={err} reset={reset} />}>
          <QRCodeWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} />
        </ErrorBoundary>
      )}
    </div>
  )
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
    toggleWidgetVisibility
  } = useDashboardLayout()
  
  const [showConfigModal, setShowConfigModal] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = widgets.findIndex((w) => w.id === active.id)
    const newIndex = widgets.findIndex((w) => w.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newLayout = arrayMove(widgets, oldIndex, newIndex)
    persistLayout(newLayout, visibleWidgetIds)
  }

  const visibleWidgets = widgets.filter((w) => visibleWidgetIds.includes(w.id))

  // ── Loading state ────────────────────────────────────────────────────────

  if (!user || !isClient) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
        </div>
      </DashboardLayout>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const greeting = getGreeting()

  return (
    <DashboardLayout>
      {/* ── Apple HIG Hero Welcome Banner ───────────────────────────────── */}
      <section
        aria-label="การทักทายและสถานะประจำวัน"
        className="relative mb-6 overflow-hidden rounded-[24px] border border-black/[0.06] bg-gradient-to-br from-white via-white to-[#e8f2fe]/50 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-7"
      >
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-3xl">
              {greeting}, <span className="text-[#0071e3]">{user.display_name || user.username}</span> 👋
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
              aria-label="จัดการวิดเจ็ต"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#475569]" aria-hidden="true" />
              จัดการวิดเจ็ต
            </button>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#0071e3]/10 blur-3xl"
        />
      </section>

      {/* ── Widget grid ─────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-12">
            {visibleWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onResize={handleResize}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Widget manager modal ─────────────────────────────────────────── */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>การแสดงผลวิดเจ็ต</DialogTitle>
            <DialogDescription>
              เปิดหรือปิดสวิตช์เพื่อจัดการวิดเจ็ตบนแดชบอร์ดหลักของคุณ
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="rounded-2xl bg-[#f5f5f7] p-2 space-y-1.5">
              {defaultWidgets
                .filter((widget) => widget.id !== 'syshealth' || user?.role === 'admin')
                .map((widget) => {
                  const isVisible = visibleWidgetIds.includes(widget.id)
                  const isLocked = isVisible && visibleWidgetIds.length <= 1
                  return (
                    <div
                      key={widget.id}
                      className={`flex items-center gap-3 rounded-xl p-3.5 transition-all duration-150 ${
                        isVisible
                          ? 'bg-white shadow-sm ring-1 ring-black/[0.06]'
                          : 'hover:bg-white/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-[#1d1d1f]">
                          {widgetNames[widget.id]}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-[1.4] text-[#6e6e73]">
                          {widgetDescriptions[widget.id]}
                        </span>
                      </div>
                      
                      {/* Custom Apple-style Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isVisible}
                        disabled={isLocked}
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 ${
                          isLocked ? 'cursor-not-allowed opacity-50' : ''
                        } ${isVisible ? 'bg-[#34c759]' : 'bg-slate-200'}`}
                      >
                        <span className="sr-only">สลับวิดเจ็ต {widgetNames[widget.id]}</span>
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isVisible ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              onClick={() => setShowConfigModal(false)}
              className="inline-flex items-center justify-center rounded-full bg-[#0071e3] px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_4px_12px_rgba(0,113,227,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              เสร็จสิ้น
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
