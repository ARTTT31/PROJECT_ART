import '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not implement these, and several hooks/components touch them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as never
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})