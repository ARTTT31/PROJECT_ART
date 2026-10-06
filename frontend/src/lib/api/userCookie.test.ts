import { describe, it, expect, afterEach } from 'vitest'

import { readUserCookie } from './userCookie'

/**
 * The cookie is written by the backend's `encode_user_cookie` (percent-encoded
 * JSON). These tests pin the wire format both ways: what a real Set-Cookie
 * value looks like, and that legacy/garbage values degrade to `null` instead of
 * throwing.
 */

function setUserCookie(value: string) {
  document.cookie = `user=${value}; path=/`
}

afterEach(() => {
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('readUserCookie', () => {
  it('decodes a percent-encoded JSON payload', () => {
    const payload = { id: 1, name: 'สมชาย, Jr.', role: 'admin', avatar: null }
    setUserCookie(encodeURIComponent(JSON.stringify(payload)))
    expect(readUserCookie()).toEqual(payload)
  })

  it('returns null when the cookie is missing', () => {
    expect(readUserCookie()).toBeNull()
  })

  it('returns null for a legacy quoted value the serialiser escaped', () => {
    // The old shape browsers stored: user="{\"id\": 1\054 \"role\": \"admin\"}"
    setUserCookie('"{\\"id\\": 1\\054 \\"role\\": \\"admin\\"}"')
    expect(readUserCookie()).toBeNull()
  })

  it('returns null for malformed values instead of throwing', () => {
    setUserCookie('not-json')
    expect(readUserCookie()).toBeNull()
    setUserCookie('%E0%B8%82')
    expect(readUserCookie()).toBeNull()
  })

  it('reads the value even when other cookies precede it', () => {
    document.cookie = 'csrf_token=abc123; path=/'
    setUserCookie(encodeURIComponent(JSON.stringify({ id: 2, role: 'user' })))
    expect(readUserCookie()).toEqual({ id: 2, role: 'user' })
  })
})
