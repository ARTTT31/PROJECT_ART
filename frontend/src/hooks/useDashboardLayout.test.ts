import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// The hook talks to the auth context and to the API layer; both are mocked so
// these tests exercise the hook's own layout logic in isolation.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, updateUser: mockUpdateUser }),
}))

vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn().mockResolvedValue({ ok: true }),
}))

import { useDashboardLayout } from '@/hooks/useDashboardLayout'
import type { WidgetConfig } from '@/types'

let mockUser: { dashboard_layout?: string | null } | null = null
const mockUpdateUser = vi.fn()

const DEFAULT_IDS = ['holidays', 'weather', 'oilprice', 'qrcode']

beforeEach(() => {
  mockUser = null
  mockUpdateUser.mockClear()
  localStorage.clear()
  vi.clearAllMocks()
})

/** Render the hook and wait for its initialization effect to settle. */
async function renderLayout() {
  const view = renderHook(() => useDashboardLayout())
  await waitFor(() => expect(view.result.current.isClient).toBe(true))
  return view
}

describe('useDashboardLayout — initialization', () => {
  it('falls back to the four default widgets with no saved state', async () => {
    const { result } = await renderLayout()

    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS)
    expect(result.current.visibleWidgetIds).toEqual(DEFAULT_IDS)
  })

  it('restores a saved layout from localStorage when the profile has none', async () => {
    const saved: WidgetConfig[] = [{ id: 'weather', w: 2 }, { id: 'qrcode', w: 1 }]
    localStorage.setItem('artWorkspaceLayoutV3', JSON.stringify(saved))

    const { result } = await renderLayout()

    expect(result.current.widgets).toEqual(expect.arrayContaining(saved))
    // Order is preserved from storage, then missing defaults are prepended.
    expect(result.current.visibleWidgetIds).toContain('weather')
    expect(result.current.visibleWidgetIds).toContain('qrcode')
  })

  it('prefers the cloud profile layout over localStorage', async () => {
    localStorage.setItem(
      'artWorkspaceLayoutV3',
      JSON.stringify([{ id: 'qrcode', w: 1 }])
    )
    mockUser = { dashboard_layout: JSON.stringify([{ id: 'weather', w: 3 }]) }

    const { result } = await renderLayout()

    const weather = result.current.widgets.find((w) => w.id === 'weather')
    expect(weather?.w).toBe(3)
  })

  it('reads the object form ({ widgets, visibleWidgetIds })', async () => {
    mockUser = {
      dashboard_layout: JSON.stringify({
        widgets: [{ id: 'oilprice', w: 1 }],
        visibleWidgetIds: ['oilprice'],
      }),
    }

    const { result } = await renderLayout()

    expect(result.current.visibleWidgetIds).toContain('oilprice')
  })

  it('survives malformed JSON in the profile without throwing', async () => {
    mockUser = { dashboard_layout: '{not valid json' }

    const { result } = await renderLayout()

    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS)
  })

  it('survives malformed JSON in localStorage without throwing', async () => {
    localStorage.setItem('artWorkspaceLayoutV3', '<<<broken')

    const { result } = await renderLayout()

    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS)
  })
})

describe('useDashboardLayout — unsupported widgets', () => {
  it('drops a retired widget id from a cloud layout', async () => {
    mockUser = {
      dashboard_layout: JSON.stringify([
        { id: 'weather', w: 1 },
        { id: 'tasks', w: 1 },
      ]),
    }

    const { result } = await renderLayout()

    expect(result.current.widgets.map((w) => w.id)).not.toContain('tasks')
    expect(result.current.visibleWidgetIds).not.toContain('tasks')
  })

  it('re-adds a default widget that is missing from a partial cloud layout', async () => {
    mockUser = { dashboard_layout: JSON.stringify([{ id: 'weather', w: 1 }]) }

    const { result } = await renderLayout()

    // A user who only saved `weather` should still get the other defaults back.
    expect(result.current.widgets.map((w) => w.id).sort()).toEqual([...DEFAULT_IDS].sort())
  })
})

describe('useDashboardLayout — mutations', () => {
  it('handleResize updates only the targeted widget width', async () => {
    const { result } = await renderLayout()

    act(() => result.current.handleResize('weather', 3))

    expect(result.current.widgets.find((w) => w.id === 'weather')?.w).toBe(3)
    expect(result.current.widgets.find((w) => w.id === 'oilprice')?.w).toBe(1)
  })

  it('toggleWidgetVisibility hides a visible widget', async () => {
    const { result } = await renderLayout()
    expect(result.current.visibleWidgetIds).toContain('weather')

    act(() => result.current.toggleWidgetVisibility('weather'))

    expect(result.current.visibleWidgetIds).not.toContain('weather')
  })

  it('toggleWidgetVisibility re-shows a hidden widget', async () => {
    const { result } = await renderLayout()

    act(() => result.current.toggleWidgetVisibility('weather'))
    expect(result.current.visibleWidgetIds).not.toContain('weather')

    act(() => result.current.toggleWidgetVisibility('weather'))
    expect(result.current.visibleWidgetIds).toContain('weather')
  })

  it('refuses to hide the last remaining visible widget', async () => {
    const { result } = await renderLayout()

    // Hide everything except `holidays`. Each toggle must run in its own act()
    // because the hook closes over `visibleWidgetIds` from the current render —
    // batching them into a single act() would reuse stale state.
    for (const id of ['weather', 'oilprice', 'qrcode']) {
      act(() => result.current.toggleWidgetVisibility(id))
    }
    expect(result.current.visibleWidgetIds).toEqual(['holidays'])

    act(() => result.current.toggleWidgetVisibility('holidays'))

    // The guard must keep at least one widget on the dashboard.
    expect(result.current.visibleWidgetIds).toEqual(['holidays'])
  })

  it('re-adds a widget to the layout when it was toggled back on', async () => {
    const { result } = await renderLayout()

    act(() => result.current.toggleWidgetVisibility('holidays'))
    expect(result.current.visibleWidgetIds).toEqual(
      expect.arrayContaining(['weather', 'oilprice', 'qrcode'])
    )
    expect(result.current.visibleWidgetIds).not.toContain('holidays')
  })
})

describe('useDashboardLayout — persistence', () => {
  it('writes the new layout to localStorage immediately', async () => {
    const { result } = await renderLayout()

    act(() => result.current.handleResize('weather', 2))

    const cached = JSON.parse(localStorage.getItem('artWorkspaceLayoutV3') || '[]')
    expect(cached.find((w: WidgetConfig) => w.id === 'weather')?.w).toBe(2)
  })

  it('debounces the backend sync instead of firing on every keystroke', async () => {
    // Initialize with real timers first — waitFor() would otherwise deadlock
    // against fake ones.
    const { result } = await renderLayout()
    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth')

    vi.useFakeTimers()
    try {
      act(() => {
        result.current.handleResize('weather', 2)
        result.current.handleResize('weather', 3)
        result.current.handleResize('weather', 4)
      })

      expect(fetchWithAuth).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })

      expect(fetchWithAuth).toHaveBeenCalledTimes(1)
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/v1/profile/dashboard-layout',
        expect.objectContaining({ method: 'POST' })
      )
    } finally {
      vi.useRealTimers()
    }
  })
})