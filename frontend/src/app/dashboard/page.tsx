'use client'


import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import CalendarWidget from '@/components/Widgets/CalendarWidget'
import TaskListWidget from '@/components/Widgets/TaskListWidget'
import OilPriceWidget from '@/components/Widgets/OilPriceWidget'
import QRCodeWidget from '@/components/Widgets/QRCodeWidget'
import { Eye, EyeOff } from 'lucide-react'
import { WidgetConfig, DashboardUser } from '@/types'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useToast } from '@/components/Toast/ToastProvider'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const defaultWidgets: WidgetConfig[] = [
  { id: 'calendar', w: 3 },
  { id: 'tasklist', w: 3 },
  { id: 'oilprice', w: 1 },
  { id: 'qrcode', w: 1 },
]

const widgetNames: Record<string, string> = {
  calendar: 'ปฏิทินกิจกรรม',
  tasklist: 'รายการงาน IMACD / ธัญพงศ์',
  oilprice: 'ราคาน้ำมัน',
  qrcode: 'สร้าง QR Code',
}

export default function DashboardPage() {
  const router = useRouter()
  const toast = useToast()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Hoisted before useEffect (const arrows are NOT hoisted in JS) ──
  const saveLayout = (newLayout: WidgetConfig[]) => {
    setWidgets(newLayout)
    localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(newLayout))
  }

  const saveVisibleWidgets = (visibleIds: string[]) => {
    setVisibleWidgetIds(visibleIds)
    localStorage.setItem('artWorkspaceVisibleWidgets', JSON.stringify(visibleIds))
  }

  // Single shared debounce ref for all localStorage writes
  const saveLayoutDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsClient(true)
    const userData = localStorage.getItem('user')
    
    if (!userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    const isAdmin = parsedUser?.role === 'admin'

    // Load visible widgets
    const savedVisible = localStorage.getItem('artWorkspaceVisibleWidgets')
    if (savedVisible) {
      try {
        const parsed: string[] = JSON.parse(savedVisible)
        setVisibleWidgetIds(parsed)
      } catch {
        setVisibleWidgetIds(defaultWidgets.map(w => w.id))
      }
    } else {
      setVisibleWidgetIds(defaultWidgets.map(w => w.id))
    }

    // Load layout
    const savedLayout = localStorage.getItem('artWorkspaceLayoutV3')
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout)
        const needsReset = parsed.length !== defaultWidgets.length || parsed.some((widget: any) => {
          const def = defaultWidgets.find(d => d.id === widget.id)
          return !def
        })

        if (needsReset) {
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
  }, [router])

  const handleResize = (id: string, newWidth: number) => {
    // Immediate state update for responsive feel (functional updater = no stale closure)
    const debounceMs = 300
    setWidgets(prev => prev.map((widget) => (widget.id === id ? { ...widget, w: newWidth } : widget)))
    // Debounce localStorage write outside the state setter (avoid side-effects inside updater)
    if (saveLayoutDebouncedRef.current) clearTimeout(saveLayoutDebouncedRef.current)
    saveLayoutDebouncedRef.current = setTimeout(() => {
      // Read latest widgets directly (not from closure)
      setWidgets(prev => {
        localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(prev))
        return prev // no change, just persist
      })
    }, debounceMs)
  }

  // 🛡️ Debounced save to prevent layout thrashing during rapid drag operations

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = widgets.findIndex((w) => w.id === active.id)
    const newIndex = widgets.findIndex((w) => w.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newLayout = arrayMove(widgets, oldIndex, newIndex)
    setWidgets(newLayout) // Optimistic update: render immediately

    // Debounce localStorage write to prevent stuttering
    if (saveLayoutDebouncedRef.current) clearTimeout(saveLayoutDebouncedRef.current)
    saveLayoutDebouncedRef.current = setTimeout(() => {
      localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(newLayout))
    }, 150) // 150ms debounce — smooth UX, no I/O jank
  }

  const toggleWidgetVisibility = (id: string) => {
    if (visibleWidgetIds.includes(id)) {
      if (visibleWidgetIds.length <= 1) return
      saveVisibleWidgets(visibleWidgetIds.filter(vId => vId !== id))
    } else {
      saveVisibleWidgets([...visibleWidgetIds, id])
    }
  }

  const visibleWidgets = widgets.filter(w => visibleWidgetIds.includes(w.id))

  if (!user || !isClient) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full">

        {/* Dashboard Grid */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 px-3 sm:px-4 lg:px-6">
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
      </div>

      {/* Widget Manager Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent title="การแสดงผลวิดเจ็ต" description="ติ๊กถูกเพื่อแสดงหรือซ่อนวิดเจ็ตบนแดชบอร์ดหลักของคุณ" className="!max-w-md">
          <div className="space-y-4">
            {defaultWidgets.filter(widget => widget.id !== 'syshealth' || user?.role === 'admin').map((widget) => {
              const isVisible = visibleWidgetIds.includes(widget.id)
              return (
                <label
                  key={widget.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${isVisible ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-500'}`}>
                      {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{widgetNames[widget.id]}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleWidgetVisibility(widget.id)}
                    className="w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 cursor-pointer"
                  />
                </label>
              )
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setShowConfigModal(false)} className="art-primary-button !min-h-[40px] !px-5 !py-2 !text-sm">
              ตกลง
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

/** Inline error fallback for individual widgets */
function WidgetErrorFallback({ name, error, reset }: { name: string; error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-[var(--art-radius-lg)] border border-red-200/50 bg-red-50/50 p-6">
      <div className="text-center">
        <p className="text-sm font-bold text-red-700">วิดเจ็ต{name} โหลดไม่สำเร็จ</p>
        <p className="mt-1 text-xs text-red-600/70">{error.message}</p>
        <button
          onClick={reset}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50"
        >
          ลองใหม่
        </button>
      </div>
    </div>
  )
}

const getColSpanClass = (w: number) => {
  if (w === 3) return 'col-span-1 md:col-span-12'
  if (w === 2) return 'col-span-1 md:col-span-8'
  return 'col-span-1 md:col-span-6'
}

/** Sortable wrapper for each widget - supports mouse, touch, and keyboard drag */
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
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }

  const colSpan = getColSpanClass(widget.w)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${colSpan}`}
    >
      {/* Invisible drag strip at top edge - only this area triggers drag */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-x-0 top-0 z-10 h-6 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`ย้ายวิดเจ็ต ${widgetNames[widget.id]}`}
      />


      {widget.id === 'calendar' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="ปฏิทิน" error={err} reset={reset} />}>
          <CalendarWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
        </ErrorBoundary>
      )}
      {widget.id === 'tasklist' && (
        <ErrorBoundary fallback={(err, reset) => <WidgetErrorFallback name="รายการงาน" error={err} reset={reset} />}>
          <TaskListWidget width={widget.w} onResize={(newSize) => onResize(widget.id, newSize)} selectedMonth={selectedMonth} />
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
