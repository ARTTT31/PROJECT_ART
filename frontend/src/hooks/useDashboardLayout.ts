import { useState, useRef, useCallback, useEffect } from 'react'
import { WidgetConfig } from '@/types'
import { fetchWithAuth } from '@/lib/api/fetchWithAuth'
import { useAuth } from '@/hooks/useAuth'

const defaultWidgets: WidgetConfig[] = [
  { id: 'holidays', w: 1 },
  { id: 'weather', w: 1 },
  { id: 'oilprice', w: 1 },
  { id: 'qrcode', w: 1 },
]

export const widgetNames: Record<string, string> = {
  holidays: 'วันหยุดนักขัตฤกษ์ (2569)',
  weather: 'สภาพอากาศ & PM 2.5',
  oilprice: 'ราคาน้ำมัน',
  qrcode: 'สร้าง QR Code',
}

export const widgetDescriptions: Record<string, string> = {
  holidays: 'ปฏิทินวันหยุดนักขัตฤกษ์ประจำปี 2569 พร้อมระบบนับถอยหลัง',
  weather: 'ตรวจสอบสภาพอากาศ อุณหภูมิ และดัชนีฝุ่น PM 2.5 รายวัน',
  oilprice: 'ติดตามราคาน้ำมันล่าสุดในหน้าแดชบอร์ด',
  qrcode: 'เปิดเครื่องมือสร้าง QR Code อย่างรวดเร็ว',
}

export function useDashboardLayout() {
  const { user, updateUser } = useAuth()
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)
  const hasInitializedRef = useRef(false)
  const saveLayoutDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cloud sync helper
  const persistLayout = useCallback((newLayout: WidgetConfig[], newVisibleIds: string[]) => {
    setWidgets(newLayout)
    setVisibleWidgetIds(newVisibleIds)

    const payload = JSON.stringify({
      widgets: newLayout,
      visibleWidgetIds: newVisibleIds,
    })

    // 1. Fast local cache
    try {
      localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(newLayout))
      localStorage.setItem('artWorkspaceVisibleWidgets', JSON.stringify(newVisibleIds))
    } catch {}

    // 2. Debounced backend sync
    if (saveLayoutDebouncedRef.current) clearTimeout(saveLayoutDebouncedRef.current)
    saveLayoutDebouncedRef.current = setTimeout(async () => {
      try {
        await fetchWithAuth('/api/v1/profile/dashboard-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dashboard_layout: payload }),
        })
        updateUser({ dashboard_layout: payload })
      } catch (err) {
        console.error('Failed to sync dashboard layout to backend:', err)
      }
    }, 400)
  }, [updateUser])

  // Initialize layout from user profile (cloud) or local storage
  useEffect(() => {
    setIsClient(true)
    if (hasInitializedRef.current && !user?.dashboard_layout) return

    let loadedWidgets = defaultWidgets
    let loadedVisible = defaultWidgets.map((w) => w.id)
    let foundCloud = false

    if (user?.dashboard_layout) {
      try {
        const parsed = JSON.parse(user.dashboard_layout)
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedWidgets = parsed
          loadedVisible = parsed.map((w: any) => w.id)
          foundCloud = true
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
            loadedWidgets = parsed.widgets
            foundCloud = true
          }
          if (Array.isArray(parsed.visibleWidgetIds) && parsed.visibleWidgetIds.length > 0) {
            loadedVisible = parsed.visibleWidgetIds
          }
        }
      } catch {}
    }

    if (!foundCloud) {
      const savedVisible = localStorage.getItem('artWorkspaceVisibleWidgets')
      if (savedVisible) {
        try {
          loadedVisible = JSON.parse(savedVisible)
        } catch {}
      }

      const savedLayout = localStorage.getItem('artWorkspaceLayoutV3')
      if (savedLayout) {
        try {
          const parsed = JSON.parse(savedLayout)
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedWidgets = parsed
          }
        } catch {}
      }
    }

    // Remove widgets that are no longer supported before restoring the layout.
    // This also cleans up the retired personal-task widget from saved profiles.
    const supportedWidgetIds = new Set(defaultWidgets.map((widget) => widget.id))
    loadedWidgets = loadedWidgets.filter((widget) => supportedWidgetIds.has(widget.id))
    loadedVisible = loadedVisible.filter((widgetId) => supportedWidgetIds.has(widgetId))

    // Ensure newly added default widgets exist in loadedWidgets
    const existingWidgetIds = new Set(loadedWidgets.map((w: any) => w.id))
    defaultWidgets.forEach((dw) => {
      if (!existingWidgetIds.has(dw.id)) {
        loadedWidgets = [dw, ...loadedWidgets]
        if (!loadedVisible.includes(dw.id)) {
          loadedVisible = [dw.id, ...loadedVisible]
        }
      }
    })

    setWidgets(loadedWidgets)
    setVisibleWidgetIds(loadedVisible)
    hasInitializedRef.current = true
  }, [user?.dashboard_layout])

  const handleResize = (id: string, newWidth: number) => {
    const updated = widgets.map((w) => (w.id === id ? { ...w, w: newWidth } : w))
    persistLayout(updated, visibleWidgetIds)
  }

  const toggleWidgetVisibility = (id: string) => {
    let newVisible: string[]
    let newWidgets = [...widgets]
    if (!newWidgets.some((w) => w.id === id)) {
      const defaultW = defaultWidgets.find((w) => w.id === id)
      newWidgets.push(defaultW || { id, w: 1 })
    }

    if (visibleWidgetIds.includes(id)) {
      if (visibleWidgetIds.length <= 1) return
      newVisible = visibleWidgetIds.filter((vId) => vId !== id)
    } else {
      newVisible = [...visibleWidgetIds, id]
    }
    persistLayout(newWidgets, newVisible)
  }
  
  const reorderWidgets = (oldIndex: number, newIndex: number) => {
    // Requires importing arrayMove from '@dnd-kit/sortable' if we move it here, 
    // but easier to just do standard array manipulation or return setWidgets.
    // We can export persistLayout and widgets to handle it in the component.
  }

  return {
    widgets,
    visibleWidgetIds,
    isClient,
    user,
    defaultWidgets,
    persistLayout,
    handleResize,
    toggleWidgetVisibility
  }
}
