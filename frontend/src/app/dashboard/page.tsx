'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import WeatherWidget from '@/components/Widgets/WeatherWidget'
import CalendarWidget from '@/components/Widgets/CalendarWidget'
import TaskListWidget from '@/components/Widgets/TaskListWidget'
import { GripVertical, LayoutGrid, Check, RotateCcw, Eye, EyeOff, Sliders, X } from 'lucide-react'

interface WidgetConfig {
  id: string
  w: number
}

const defaultWidgets: WidgetConfig[] = [
  { id: 'weather', w: 1 },
  { id: 'calendar', w: 1 },
  { id: 'tasklist', w: 1 },
]

const widgetNames: Record<string, string> = {
  weather: 'สภาพอากาศ',
  calendar: 'ปฏิทินกิจกรรม',
  tasklist: 'รายการงาน IMACD / ธัญพงศ์',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const token = localStorage.getItem('access_token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/login')
      return
    }

    setUser(JSON.parse(userData))

    // Load visible widgets
    const savedVisible = localStorage.getItem('artWorkspaceVisibleWidgets')
    if (savedVisible) {
      try {
        setVisibleWidgetIds(JSON.parse(savedVisible))
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

  const saveLayout = (newLayout: WidgetConfig[]) => {
    setWidgets(newLayout)
    localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(newLayout))
  }

  const saveVisibleWidgets = (visibleIds: string[]) => {
    setVisibleWidgetIds(visibleIds)
    localStorage.setItem('artWorkspaceVisibleWidgets', JSON.stringify(visibleIds))
  }

  const handleResize = (id: string, newWidth: number) => {
    saveLayout(widgets.map((widget) => (widget.id === id ? { ...widget, w: newWidth } : widget)))
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return
    setDragOverIdx(idx)
  }

  const handleDrop = (idx: number) => {
    if (draggedIdx === null) return
    const updated = [...widgets]
    const draggedItem = updated[draggedIdx]
    updated.splice(draggedIdx, 1)
    updated.splice(idx, 0, draggedItem)
    setDraggedIdx(null)
    setDragOverIdx(null)
    saveLayout(updated)
  }

  const handleResetLayout = () => {
    saveLayout(defaultWidgets)
    saveVisibleWidgets(defaultWidgets.map(w => w.id))
  }

  const toggleWidgetVisibility = (id: string) => {
    if (visibleWidgetIds.includes(id)) {
      if (visibleWidgetIds.length <= 1) return
      saveVisibleWidgets(visibleWidgetIds.filter(vId => vId !== id))
    } else {
      saveVisibleWidgets([...visibleWidgetIds, id])
    }
  }

  const renderWidget = (id: string) => {
    switch (id) {
      case 'weather': return <WeatherWidget />
      case 'tasklist': return <TaskListWidget />
      case 'calendar': return <CalendarWidget />
      default: return null
    }
  }

  const getColSpanClass = (w: number) => {
    if (w === 3) return 'lg:col-span-3 md:col-span-3 col-span-1'
    if (w === 2) return 'lg:col-span-2 md:col-span-2 col-span-1'
    return 'lg:col-span-1 md:col-span-1 col-span-1'
  }

  if (!user || !isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-1">

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {widgets
            .filter(widget => visibleWidgetIds.includes(widget.id))
            .map((widget, idx) => {
              const colSpan = getColSpanClass(widget.w)
              const isDragged = draggedIdx === idx
              const isOver = dragOverIdx === idx

              return (
                <div
                  key={widget.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragLeave={() => setDragOverIdx(null)}
                  className={`group relative transition-all duration-300 ${colSpan} ${
                    isDragged ? 'opacity-30 scale-95' : 'opacity-100'
                  } ${isOver ? 'border-2 border-dashed border-sky-400 bg-sky-50/20 rounded-3xl p-1' : ''}`}
                >
                  {/* Widget Card Container */}
                  <div className="h-full rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
                    {widget.id === 'weather' && (
                      <WeatherWidget width={widget.w} onResize={(newSize) => handleResize(widget.id, newSize)} />
                    )}
                    {widget.id === 'calendar' && (
                      <CalendarWidget width={widget.w} onResize={(newSize) => handleResize(widget.id, newSize)} />
                    )}
                    {widget.id === 'tasklist' && (
                      <TaskListWidget width={widget.w} onResize={(newSize) => handleResize(widget.id, newSize)} />
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Widget Manager Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md overflow-hidden transform animate-scale-in !p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/20 bg-white/30">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-500" />
                <h3 className="text-lg font-bold text-slate-800">การแสดงผลวิดเจ็ต</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                ติ๊กถูกเพื่อแสดงหรือซ่อนวิดเจ็ตบนแดชบอร์ดหลักของคุณ
              </p>
              {defaultWidgets.map((widget) => {
                const isVisible = visibleWidgetIds.includes(widget.id)
                return (
                  <label
                    key={widget.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-white/40 bg-white/40 hover:bg-white/70 hover:border-white/60 transition-all cursor-pointer group shadow-glass-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl transition-all ${isVisible ? 'bg-sky-500/10 text-sky-600' : 'bg-slate-500/10 text-slate-500'}`}>
                        {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-slate-800">{widgetNames[widget.id]}</span>
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

            {/* Footer */}
            <div className="p-6 bg-white/30 border-t border-white/20 flex items-center justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="art-primary-button !rounded-2xl"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

