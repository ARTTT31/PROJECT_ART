import { describe, it, expect, vi, afterEach } from 'vitest'

import { formatRelativeTime, parseUserAgent } from './userAgent'

/**
 * These helpers feed the session list in the profile page: the browser/OS label
 * is shown to the user when deciding which session to revoke, so a wrong or
 * missing label is a security-relevant UX bug, not cosmetics.
 */

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91'
const FIREFOX_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const SAFARI_MACOS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'

describe('parseUserAgent', () => {
  it('reports unknown values for a missing user agent', () => {
    expect(parseUserAgent(null)).toEqual({ browser: 'ไม่ระบุ', os: 'ไม่ระบุ', isMobile: false })
    expect(parseUserAgent('')).toEqual({ browser: 'ไม่ระบุ', os: 'ไม่ระบุ', isMobile: false })
  })

  it('parses Chrome on Windows', () => {
    expect(parseUserAgent(CHROME_WINDOWS)).toEqual({
      browser: 'Chrome 120',
      os: 'Windows 10/11',
      isMobile: false,
    })
  })

  it('prefers Edge over the Chrome token it also carries', () => {
    // Edge UAs contain "Chrome/…" too, so ordering in the parser matters here.
    expect(parseUserAgent(EDGE_WINDOWS).browser).toBe('Edge 120')
  })

  it('parses Firefox on Linux', () => {
    expect(parseUserAgent(FIREFOX_LINUX)).toEqual({
      browser: 'Firefox 121',
      os: 'Linux',
      isMobile: false,
    })
  })

  it('parses Safari on iOS and flags it as mobile', () => {
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
      browser: 'Safari 17.2',
      os: 'iOS 17.2',
      isMobile: true,
    })
  })

  it('parses Chrome on Android and flags it as mobile', () => {
    const parsed = parseUserAgent(CHROME_ANDROID)
    expect(parsed.os).toBe('Android 14')
    expect(parsed.browser).toBe('Chrome 120')
    expect(parsed.isMobile).toBe(true)
  })

  it('parses Safari on macOS without treating it as Chrome', () => {
    expect(parseUserAgent(SAFARI_MACOS)).toEqual({
      browser: 'Safari 17.1',
      os: 'macOS 10.15',
      isMobile: false,
    })
  })

  it('never throws on an unrecognised agent string', () => {
    expect(parseUserAgent('SomeCustomAgent/1.0')).toEqual({
      browser: 'ไม่ระบุ',
      os: 'ไม่ระบุ',
      isMobile: false,
    })
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports unknown values for a missing date', () => {
    expect(formatRelativeTime(null)).toEqual({ relative: 'ไม่ระบุ', absolute: '' })
    expect(formatRelativeTime(undefined)).toEqual({ relative: 'ไม่ระบุ', absolute: '' })
  })

  it('describes sub-minute, minute, hour and day offsets in Thai', () => {
    const now = new Date('2026-06-09T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

    expect(formatRelativeTime(ago(5_000)).relative).toBe('เมื่อสักครู่')
    expect(formatRelativeTime(ago(10 * 60_000)).relative).toBe('10 นาทีที่แล้ว')
    expect(formatRelativeTime(ago(3 * 60 * 60_000)).relative).toBe('3 ชั่วโมงที่แล้ว')
    expect(formatRelativeTime(ago(2 * 24 * 60 * 60_000)).relative).toBe('2 วันที่แล้ว')
  })

  it('always produces a non-empty absolute label', () => {
    const recent = new Date(Date.now() - 90 * 60_000).toISOString()

    expect(formatRelativeTime(recent).absolute.length).toBeGreaterThan(0)
  })
})
