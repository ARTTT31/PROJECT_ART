import { describe, it, expect } from 'vitest'

import {
  DEFAULT_MAIN_MENU_ITEMS,
  parseMainMenuConfig,
  serializeMainMenuConfig,
} from './mainMenu'

/**
 * The saved menu config is user-editable JSON, so the parser has to survive junk
 * while still guaranteeing that required items (dashboard/profile) can never be
 * switched off — otherwise the user locks themselves out of the app's chrome.
 */

const defaultIds = DEFAULT_MAIN_MENU_ITEMS.map((item) => item.id)

describe('parseMainMenuConfig', () => {
  it('falls back to the defaults for empty input', () => {
    expect(parseMainMenuConfig(null)).toEqual(DEFAULT_MAIN_MENU_ITEMS)
    expect(parseMainMenuConfig(undefined)).toEqual(DEFAULT_MAIN_MENU_ITEMS)
    expect(parseMainMenuConfig('')).toEqual(DEFAULT_MAIN_MENU_ITEMS)
  })

  it('falls back to the defaults for malformed JSON', () => {
    expect(parseMainMenuConfig('[broken')).toEqual(DEFAULT_MAIN_MENU_ITEMS)
  })

  it('falls back to the defaults when the payload is not an array', () => {
    expect(parseMainMenuConfig('{"id":"dashboard"}')).toEqual(DEFAULT_MAIN_MENU_ITEMS)
  })

  it('ignores ids that are not part of the known menu', () => {
    const raw = JSON.stringify([{ id: 'dashboard', enabled: true }, { id: 'not-a-page', enabled: true }])

    expect(parseMainMenuConfig(raw).map((item) => item.id)).toEqual(defaultIds)
  })

  it('keeps the saved order for known items', () => {
    const raw = JSON.stringify([
      { id: 'profile', enabled: true },
      { id: 'dashboard', enabled: true },
    ])

    expect(parseMainMenuConfig(raw).map((item) => item.id)).toEqual(['profile', 'dashboard', 'camera'])
  })

  it('appends defaults that are missing from the saved config', () => {
    const raw = JSON.stringify([{ id: 'dashboard', enabled: true }])

    expect(parseMainMenuConfig(raw).map((item) => item.id)).toEqual(defaultIds)
  })

  it('refuses to disable a required item even when the saved config says so', () => {
    const raw = JSON.stringify([{ id: 'dashboard', enabled: false }])

    const dashboard = parseMainMenuConfig(raw).find((item) => item.id === 'dashboard')
    expect(dashboard?.enabled).toBe(true)
  })

  it('honours disabling an optional item', () => {
    const raw = JSON.stringify([
      { id: 'dashboard', enabled: true },
      { id: 'camera', enabled: false },
    ])

    const camera = parseMainMenuConfig(raw).find((item) => item.id === 'camera')
    expect(camera?.enabled).toBe(false)
  })

  it('treats a missing enabled flag on an optional item as disabled', () => {
    const raw = JSON.stringify([{ id: 'camera' }])

    expect(parseMainMenuConfig(raw).find((item) => item.id === 'camera')?.enabled).toBe(false)
  })

  it('drops entries that are not objects without duplicating ids', () => {
    const raw = JSON.stringify([null, 7, 'camera', { id: 'camera', enabled: true }])

    const ids = parseMainMenuConfig(raw).map((item) => item.id)
    expect([...ids].sort()).toEqual([...defaultIds].sort())
    expect(ids.filter((id) => id === 'camera')).toHaveLength(1)
  })
})

describe('serializeMainMenuConfig', () => {
  it('persists only the id and enabled flag', () => {
    expect(JSON.parse(serializeMainMenuConfig(DEFAULT_MAIN_MENU_ITEMS))).toEqual([
      { id: 'dashboard', enabled: true },
      { id: 'camera', enabled: true },
      { id: 'profile', enabled: true },
    ])
  })

  it('round-trips through parse', () => {
    const items = DEFAULT_MAIN_MENU_ITEMS.map((item) =>
      item.id === 'camera' ? { ...item, enabled: false } : item
    )

    const restored = parseMainMenuConfig(serializeMainMenuConfig(items))
    expect(restored.find((item) => item.id === 'camera')?.enabled).toBe(false)
    expect(restored.find((item) => item.id === 'dashboard')?.enabled).toBe(true)
  })
})
