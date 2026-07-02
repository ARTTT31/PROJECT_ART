'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { Check, Eye, EyeOff, GripHorizontal, Loader2, SlidersHorizontal } from 'lucide-react'
import { WidgetConfig } from '@/types'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useAuth } from '@/hooks/useAuth'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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

// ── Lazy-load heavy widgets ──────────────────────────────────────────────────

/** Shared skeleton tile used while a widget is loading */
function WidgetSkeleton({ minHeight = 220 }: { minHeight?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[28px] bg-[#f5f5f7]"
      style={{ minHeight }}
      role="status"
      aria-label="กำลังโหลด"
    >
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )
}

const CalendarWidget = dynamic(() => import('@/components/Widgets/CalendarWidget'), {
  ssr: false,
  loading: () => <WidgetSkeleton minHeight={400} />,
})

const TaskListWidget = dynamic(() => import('@/components/Widgets/TaskListWidget'), {
  ssr: false,
  loading: () => <WidgetSkeleton minHeight={400} />,
})

const OilPriceWidget = dynamic(() => import('@/components/Widgets/OilPriceWidget'), {
  ssr: false,
  loading: () => <WidgetSkeleton minHeight={220} />,
})

const QRCodeWidget = dynamic(() => import('@/components/Widgets/QRCodeWidget'), {
  ssr: false,
  loading: () => <WidgetSkeleton minHeight={220} />,
})

// ── Widget registry ──────────────────────────────────────────────────────────

const defaultWidgets: WidgetConfig[] = [
  // { id: 'calendar', w: 3 }, // 🚧 ปฏิทินกิจกรรม — ยังไม่พร้อมใช้งาน
  // { id: 'tasklist', w: 3 }, // 🚧 รายการงาน — ยังไม่พร้อมใช้งาน
  { id: 'oilprice', w: 1 },
  { id: 'qrcode', w: 1 },
]

const widgetNames: Record<string, string> = {
  calendar: 'ปฏิทินกิจกรรม',
  tasklist: 'รายการงาน IMACD / ธัญพงศ์',
  oilprice: 'ราคาน้ำมัน',
  qrcode: 'สร้าง QR Code',
}

const widgetDescriptions: Record<string, string> = {
  calendar: 'แสดงปฏิทินกิจกรรมจาก Google Calendar',
  tasklist: 'สรุปรายการงานและกำหนดการสำคัญ',
  oilprice: 'ติดตามราคาน้ำมันล่าสุดในหน้าแดชบอร์ด',
  qrcode: 'เปิดเครื่องมือสร้าง QR Code อย่างรวดเร็ว',
}

// ── Col-span helper ──────────────────────────────────────────────────────────

const getColSpanClass = (w: number) => {
  if (w === 3) return 'col-span-full'
  if (w === 2) return 'col-span-full md:col-span-8'
  return 'col-span-full md:col-span-6'
}

// ── Inline error fallback ────────────────────────────────────────────────────

function WidgetErrorFallback({ name, error, reset }: { name: string; error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-[28px] bg-[#fff0f0] p-6">
      <div className="text-center">
        <p className="text-sm font-bold text-red-700">วิดเจ็ต{name} โหลดไม่สำเร็จ</p>
        <p className="mt-1 text-xs text-red-500/80">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          ลองใหม่
        </button>
      </div>
    </div>
  )
}

// ── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  widget,
  onResize,
  selectedMonth,
  onMonthChange,
}: {
  widget: WidgetConfig
  onResize: (id: string, newWidth: number) => void
  selectedMonth: Date
  onMonthChange: (date: Date) => void
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
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : ('auto' as const),
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
        className="absolute inset-x-0 top-0 z-10 flex h-10 cursor-grab items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing touch-none"
        aria-label={`ย้ายวิดเจ็ต ${widgetNames[widget.id]}`}
      >
        <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-black/[0.06]">
          <GripHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        </span>
      </div>

      {/* Widget content */}
      {widget.id === 'calendar' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="ปฏิทิน" error={err} reset={reset} />}>
          <CalendarWidget
            width={widget.w}
            onResize={(newSize) => onResize(widget.id, newSize)}
            selectedMonth={selectedMonth}
            onMonthChange={onMonthChange}
          />
        </ErrorBoundary>
      )}
      {widget.id === 'tasklist' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="รายการงาน" error={err} reset={reset} />}>
          <TaskListWidget
            width={widget.w}
            onResize={(newSize) => onResize(widget.id, newSize)}
            selectedMonth={selectedMonth}
          />
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
  const { user } = useAuth()
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const saveLayout = (newLayout: WidgetConfig[]) => {
    setWidgets(newLayout)
    localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(newLayout))
  }

  const saveVisibleWidgets = (visibleIds: string[]) => {
    setVisibleWidgetIds(visibleIds)
    localStorage.setItem('artWorkspaceVisibleWidgets', JSON.stringify(visibleIds))
  }

  const saveLayoutDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsClient(true)

    // Restore visible widgets
    const savedVisible = localStorage.getItem('artWorkspaceVisibleWidgets')
    if (savedVisible) {
      try {
        setVisibleWidgetIds(JSON.parse(savedVisible))
      } catch {
        setVisibleWidgetIds(defaultWidgets.map((w) => w.id))
      }
    } else {
      setVisibleWidgetIds(defaultWidgets.map((w) => w.id))
    }

    // Restore layout
    const savedLayout = localStorage.getItem('artWorkspaceLayoutV3')
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout)
        const stale =
          parsed.length !== defaultWidgets.length ||
          parsed.some((widget: any) => !defaultWidgets.find((d) => d.id === widget.id))
        if (stale) {
          saveLayout(defaultWidgets)
        } else {
          setWidgets(parsed)
        }
      } catch {
        setWidgets(defaultWidgets)
      }
    } else {
      setWidgets(defaultWidgets)
    }
  }, [])

  const handleResize = (id: string, newWidth: number) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, w: newWidth } : w)))
    if (saveLayoutDebouncedRef.current) clearTimeout(saveLayoutDebouncedRef.current)
    saveLayoutDebouncedRef.current = setTimeout(() => {
      setWidgets((prev) => {
        localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(prev))
        return prev
      })
    }, 300)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = widgets.findIndex((w) => w.id === active.id)
    const newIndex = widgets.findIndex((w) => w.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newLayout = arrayMove(widgets, oldIndex, newIndex)
    setWidgets(newLayout)
    if (saveLayoutDebouncedRef.current) clearTimeout(saveLayoutDebouncedRef.current)
    saveLayoutDebouncedRef.current = setTimeout(() => {
      localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(newLayout))
    }, 150)
  }

  const toggleWidgetVisibility = (id: string) => {
    if (visibleWidgetIds.includes(id)) {
      if (visibleWidgetIds.length <= 1) return
      saveVisibleWidgets(visibleWidgetIds.filter((vId) => vId !== id))
    } else {
      saveVisibleWidgets([...visibleWidgetIds, id])
    }
  }

  const visibleWidgets = widgets.filter((w) => visibleWidgetIds.includes(w.id))

  // ── Loading state ────────────────────────────────────────────────────────

  if (!user || !isClient) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7]">
        <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#f5f5f7] border-t-[#0071e3]" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <h1 className="sr-only">แดชบอร์ด — ART Workspace</h1>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* Page eyebrow */}
        <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]">
          แดชบอร์ด
        </p>

        {/* Manage widgets — Apple pill button */}
        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.08] transition-all duration-150 hover:bg-[#f5f5f7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
          aria-label="จัดการวิดเจ็ต"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#6e6e73]" aria-hidden="true" />
          จัดการวิดเจ็ต
        </button>
      </div>

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
          <div className="grid grid-cols-1 gap-4 px-3 sm:gap-5 sm:px-4 md:grid-cols-12 lg:px-6">
            {visibleWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onResize={handleResize}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
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
              ติ๊กถูกเพื่อแสดงหรือซ่อนวิดเจ็ตบนแดชบอร์ดหลักของคุณ
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="rounded-2xl bg-[#f5f5f7] p-2">
              {defaultWidgets
                .filter((widget) => widget.id !== 'syshealth' || user?.role === 'admin')
                .map((widget) => {
                  const isVisible = visibleWidgetIds.includes(widget.id)
                  const isLocked = isVisible && visibleWidgetIds.length <= 1
                  return (
                    <label
                      key={widget.id}
                      className={`group relative mb-1.5 flex cursor-pointer items-center gap-3 rounded-xl p-3.5 transition-all duration-150 last:mb-0 ${
                        isVisible
                          ? 'bg-white shadow-sm ring-1 ring-black/[0.06]'
                          : 'hover:bg-white/70'
                      } ${isLocked ? 'cursor-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={isLocked}
                        onChange={() => toggleWidgetVisibility(widget.id)}
                        className="peer sr-only"
                      />

                      {/* Icon */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-150 ${
                          isVisible
                            ? 'bg-[#0071e3]/10 text-[#0071e3]'
                            : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                        }`}
                      >
                        {isVisible
                          ? <Eye className="h-4 w-4" aria-hidden="true" />
                          : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                      </div>

                      {/* Labels */}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#1d1d1f]">
                          {widgetNames[widget.id]}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-[1.4] text-[#6e6e73]">
                          {widgetDescriptions[widget.id]}
                        </span>
                      </div>

                      {/* Status + checkmark */}
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex ${
                            isVisible
                              ? 'bg-[#0071e3]/10 text-[#0071e3]'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isVisible ? 'แสดงอยู่' : 'ซ่อนอยู่'}
                        </span>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-150 ${
                            isVisible
                              ? 'bg-[#0071e3] text-white'
                              : 'border border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </div>
                      </div>
                    </label>
                  )
                })}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              onClick={() => setShowConfigModal(false)}
              className="inline-flex items-center justify-center rounded-full bg-[#0071e3] px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[#0077ed] hover:shadow-[0_4px_12px_rgba(0,113,227,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              ตกลง
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
