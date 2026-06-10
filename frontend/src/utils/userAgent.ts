/**
 * User-Agent parsing utilities for session display
 */

import type { ParsedUA } from '@/types'

/**
 * Parse a User-Agent string into human-readable browser + OS info.
 * Intentionally lightweight — no external dependency needed.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua) {
    return { browser: 'ไม่ระบุ', os: 'ไม่ระบุ', isMobile: false }
  }

  const lower = ua.toLowerCase()

  // ── OS ───────────────────────────────────────────────
  let os = 'ไม่ระบุ'
  if (lower.includes('windows')) {
    if (lower.includes('windows nt 10')) os = 'Windows 10/11'
    else if (lower.includes('windows nt 6.3')) os = 'Windows 8.1'
    else if (lower.includes('windows nt 6.2')) os = 'Windows 8'
    else if (lower.includes('windows nt 6.1')) os = 'Windows 7'
    else os = 'Windows'
  } else if (lower.includes('mac os x')) {
    const ver = ua.match(/mac os x (\d+[._]\d+)/)
    os = ver ? `macOS ${ver[1].replace('_', '.')}` : 'macOS'
  } else if (lower.includes('android')) {
    const ver = ua.match(/android (\d+(\.\d+)?)/)
    os = ver ? `Android ${ver[1]}` : 'Android'
  } else if (lower.includes('iphone') || lower.includes('ipad')) {
    const ver = ua.match(/os (\d+[._]\d+)/)
    os = ver ? `iOS ${ver[1].replace('_', '.')}` : 'iOS'
  } else if (lower.includes('linux')) {
    os = 'Linux'
  } else if (lower.includes('cros')) {
    os = 'Chrome OS'
  }

  // ── Browser ──────────────────────────────────────────
  let browser = 'ไม่ระบุ'
  if (lower.includes('edg/')) {
    const ver = ua.match(/edg\/(\d+)/)
    browser = ver ? `Edge ${ver[1]}` : 'Edge'
  } else if (lower.includes('opr/') || lower.includes('opera')) {
    const ver = ua.match(/opr\/(\d+)/)
    browser = ver ? `Opera ${ver[1]}` : 'Opera'
  } else if (lower.includes('firefox/')) {
    const ver = ua.match(/firefox\/(\d+)/)
    browser = ver ? `Firefox ${ver[1]}` : 'Firefox'
  } else if (lower.includes('chrome/') && !lower.includes('edg/')) {
    const ver = ua.match(/chrome\/(\d+)/)
    browser = ver ? `Chrome ${ver[1]}` : 'Chrome'
  } else if (lower.includes('safari/') && !lower.includes('chrome')) {
    const ver = ua.match(/version\/(\d+(\.\d+)?)/)
    browser = ver ? `Safari ${ver[1]}` : 'Safari'
  }

  const isMobile = /mobile|android|iphone|ipad|ipod|phone/i.test(ua)

  return { browser, os, isMobile }
}

/**
 * Format an ISO date string into a relative + absolute Thai display.
 * e.g. "2 ชั่วโมงที่แล้ว · 14:30 9 มิ.ย."
 */
export function formatRelativeTime(isoDate: string | null | undefined): {
  relative: string
  absolute: string
} {
  if (!isoDate) {
    return { relative: 'ไม่ระบุ', absolute: '' }
  }

  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  let relative = ''
  if (diffSec < 60) {
    relative = 'เมื่อสักครู่'
  } else if (diffMin < 60) {
    relative = `${diffMin} นาทีที่แล้ว`
  } else if (diffHour < 24) {
    relative = `${diffHour} ชั่วโมงที่แล้ว`
  } else if (diffDay < 30) {
    relative = `${diffDay} วันที่แล้ว`
  } else {
    relative = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const absolute = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    + ' '
    + date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

  return { relative, absolute }
}
