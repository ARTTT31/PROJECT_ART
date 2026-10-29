import '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not implement these, and several hooks/components touch them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)

// Node 26 exposes an experimental `localStorage` global that resolves to
// `undefined` unless the process is started with `--localstorage-file`. It is an
// own property of `globalThis`, so it shadows the jsdom Storage that Vitest
// installs, and `localStorage.clear()` throws in every test. Supply a
// spec-shaped in-memory Storage only when the runtime's own is unusable, so this
// stays a no-op on Node 20/22/24, where jsdom's implementation is present.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>()
  const localStorageStub: Storage = {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => {
      const value = store.get(key)
      return value === undefined ? null : value
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageStub,
    configurable: true,
    writable: true,
  })
}

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