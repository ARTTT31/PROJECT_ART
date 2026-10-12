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
  holidays: 'วันหยุดนักขัตฤกษ์',
  weather: 'สภาพอากาศ & PM 2.5',
  oilprice: 'ราคาน้ำมัน',
  qrcode: 'สร้าง QR Code',
}

export const widgetDescriptions: Record<string, string> = {
  holidays: 'ปฏิทินวันหยุดนักขัตฤกษ์ พร้อมระบบนับถอยหลัง',
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

  // Track the latest layout string the USER (not the cloud echo) wrote, so
  // the init effect below can tell "cloud was just updated by me" apart from
  // "cloud was updated on another device".
  const localLayoutRef = useRef<string | null>(null)

  // Track the layout state in a ref so drag/resize handlers mutate the CURRENT
  // layout even when React has not re-rendered between rapid interactions.
  // Handlers now read from the ref (source of truth at call time) and write
  // back to both — eliminating the stale-state race during rapid drags/resizes.
  const widgetsRef = useRef<WidgetConfig[]>([])
  const visibleIdsRef = useRef<string[]>([])

  const applyLayout = useCallback((nextWidgets: WidgetConfig[], nextVisible: string[]) => {
    widgetsRef.current = nextWidgets
    visibleIdsRef.current = nextVisible
    setWidgets(nextWidgets)
    setVisibleWidgetIds(nextVisible)
  }, [])

  // Cloud sync helper
  const persistLayout = useCallback((newLayout: WidgetConfig[], newVisibleIds: string[]) => {
    applyLayout(newLayout, newVisibleIds)

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
        localLayoutRef.current = payload
        updateUser({ dashboard_layout: payload })
      } catch (err) {
        console.error('Failed to sync dashboard layout to backend:', err)
      }
    }, 400)
  }, [updateUser, applyLayout])

  // Initialize layout from user profile (cloud) or local storage
  useEffect(() => {
    setIsClient(true)
    if (hasInitializedRef.current) {
      // After the first init: only re-run when the cloud value is genuinely NEW
      // (i.e. another device changed the layout). The echo of our own save
      // (identical string) must NOT reset state — it used to wipe an in-flight
      // drag/resize that happened during the 400ms debounce window.
      if (
        !user?.dashboard_layout ||
        user.dashboard_layout === localLayoutRef.current
      ) {
        return
      }
    }

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

    applyLayout(loadedWidgets, loadedVisible)
    hasInitializedRef.current = true
  }, [user?.dashboard_layout, applyLayout])

  const handleResize = (id: string, newWidth: number) => {
    // Read the ref, not React state: rapid successive resizes within one render
    // batch would otherwise each start from the same stale array and lose the
    // earlier writes.
    const updated = widgetsRef.current.map((w) => (w.id === id ? { ...w, w: newWidth } : w))
    persistLayout(updated, visibleIdsRef.current)
  }

  const toggleWidgetVisibility = (id: string) => {
    let newVisible: string[]
    let newWidgets = [...widgetsRef.current]
    if (!newWidgets.some((w) => w.id === id)) {
      const defaultW = defaultWidgets.find((w) => w.id === id)
      newWidgets.push(defaultW || { id, w: 1 })
    }

    if (visibleIdsRef.current.includes(id)) {
      if (visibleIdsRef.current.length <= 1) return
      newVisible = visibleIdsRef.current.filter((vId) => vId !== id)
    } else {
      newVisible = [...visibleIdsRef.current, id]
    }
    persistLayout(newWidgets, newVisible)
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
