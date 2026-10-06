import { describe, it, expect } from 'vitest'

import {
  QUICK_LINK_ICON_MAP,
  QUICK_LINK_ICON_OPTIONS,
  isExternalUrl,
  parseQuickLinks,
  serializeQuickLinks,
} from './quickLinks'

/**
 * These helpers are the only thing standing between user-editable JSON (from the
 * profile page and the saved cloud profile) and the sidebar's rendering, so the
 * rejection rules matter as much as the happy path.
 */

describe('isExternalUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isExternalUrl('https://example.com')).toBe(true)
    expect(isExternalUrl('http://example.com')).toBe(true)
  })

  it('is case-insensitive about the scheme', () => {
    expect(isExternalUrl('HTTPS://Example.com')).toBe(true)
  })

  it('rejects in-app paths and non-http schemes', () => {
    expect(isExternalUrl('/dashboard')).toBe(false)
    expect(isExternalUrl('mailto:someone@example.com')).toBe(false)
    expect(isExternalUrl('example.com')).toBe(false)
  })
})

describe('parseQuickLinks', () => {
  it('returns an empty list for empty input', () => {
    expect(parseQuickLinks(null)).toEqual([])
    expect(parseQuickLinks(undefined)).toEqual([])
    expect(parseQuickLinks('')).toEqual([])
  })

  it('returns an empty list for malformed JSON instead of throwing', () => {
    expect(parseQuickLinks('{not json')).toEqual([])
  })

  it('returns an empty list when the payload is not an array', () => {
    expect(parseQuickLinks('{"id":"a","label":"A","url":"https://a.test","icon":"link"}')).toEqual([])
  })

  it('keeps a well-formed entry and trims its text fields', () => {
    const raw = JSON.stringify([
      { id: '  mail  ', label: '  อีเมล  ', url: '  https://mail.test  ', icon: 'mail', color: '  #ff0000  ' },
    ])

    expect(parseQuickLinks(raw)).toEqual([
      { id: 'mail', label: 'อีเมล', url: 'https://mail.test', icon: 'mail', color: '#ff0000' },
    ])
  })

  it('drops entries that are missing a label or a url', () => {
    const raw = JSON.stringify([
      { id: 'no-label', url: 'https://a.test', icon: 'link' },
      { id: 'no-url', label: 'No URL', icon: 'link' },
      { id: '   ', label: '   ', url: 'https://b.test', icon: 'link' },
      { id: 'ok', label: 'OK', url: 'https://ok.test', icon: 'link' },
    ])

    expect(parseQuickLinks(raw).map((link) => link.id)).toEqual(['ok'])
  })

  it('drops entries whose icon is not in the known icon set', () => {
    const raw = JSON.stringify([
      { id: 'unknown', label: 'Unknown', url: 'https://a.test', icon: 'definitely-not-an-icon' },
      { id: 'missing', label: 'Missing Icon', url: 'https://b.test' },
      { id: 'ok', label: 'OK', url: 'https://ok.test', icon: 'globe' },
    ])

    expect(parseQuickLinks(raw).map((link) => link.id)).toEqual(['ok'])
  })

  it('drops non-object entries', () => {
    const raw = JSON.stringify(['nope', 42, null, { id: 'ok', label: 'OK', url: 'u', icon: 'link' }])

    expect(parseQuickLinks(raw).map((link) => link.id)).toEqual(['ok'])
  })

  it('invents an id when one is missing so React has a stable key source', () => {
    const raw = JSON.stringify([{ label: 'No id', url: 'https://a.test', icon: 'link' }])

    const [link] = parseQuickLinks(raw)
    expect(link.id).toBeTruthy()
    expect(typeof link.id).toBe('string')
  })
})

describe('serializeQuickLinks', () => {
  it('round-trips through parse without losing data', () => {
    const links = [
      { id: 'a', label: 'A', url: 'https://a.test', icon: 'star' as const },
      { id: 'b', label: 'B', url: 'https://b.test', icon: 'globe' as const, color: '#0066cc' },
    ]

    expect(parseQuickLinks(serializeQuickLinks(links))).toEqual(links)
  })

  it('cleans invalid entries instead of persisting them', () => {
    const dirty = [
      { id: 'ok', label: 'OK', url: 'https://ok.test', icon: 'link' as const },
      { id: 'bad', label: '', url: 'https://bad.test', icon: 'link' as const },
    ]

    expect(JSON.parse(serializeQuickLinks(dirty))).toEqual([
      { id: 'ok', label: 'OK', url: 'https://ok.test', icon: 'link' },
    ])
  })
})

describe('icon catalogue', () => {
  it('offers a picker entry for every selectable icon', () => {
    // A key present in the picker but missing from the map would render as an
    // undefined component at runtime, so both must stay in lockstep.
    for (const option of QUICK_LINK_ICON_OPTIONS) {
      expect(QUICK_LINK_ICON_MAP[option.key]).toBeTruthy()
      expect(option.label).toBeTruthy()
    }
  })

  it('has no duplicate picker keys', () => {
    const keys = QUICK_LINK_ICON_OPTIONS.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
