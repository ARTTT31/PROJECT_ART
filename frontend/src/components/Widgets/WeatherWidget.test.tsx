import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import WeatherWidget from './WeatherWidget'

/**
 * Regression cover for the production incident where Open-Meteo returned 429 and
 * the widget rendered a tall, mostly-empty card in the dashboard grid.
 */

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()

  // Seed a saved city so the widget fetches directly instead of falling into
  // geolocation detection (unavailable in jsdom). No weather cache, so the
  // request really goes out — and every call rejects.
  localStorage.setItem(
    'artWeatherLocationV7',
    JSON.stringify({ id: 'bkk', label: 'กรุงเทพฯ', lat: 13.7563, lon: 100.5018 })
  )
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Upstream provider returned HTTP 429'))
  )
})

describe('WeatherWidget — upstream failure', () => {
  it('renders a compact, actionable card instead of an empty shell', async () => {
    render(<WeatherWidget />)

    await waitFor(() => expect(screen.getByRole('button', { name: /ลองอีกครั้ง/ })).toBeTruthy())

    // The failure reason is explained rather than left as blank space.
    expect(screen.getByText(/เกิดข้อผิดพลาด/)).toBeTruthy()
  })

  it('still shows the widget title so the card is identifiable', async () => {
    render(<WeatherWidget />)

    await waitFor(() => expect(screen.getByText('สภาพอากาศ & PM 2.5')).toBeTruthy())
  })

  it('lets the user retry', async () => {
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

    render(<WeatherWidget />)
    const retry = await screen.findByRole('button', { name: /ลองอีกครั้ง/ })
    const before = spy.mock.calls.length

    retry.click()

    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before))
  })

  it('does not render the error state while still loading', () => {
    render(<WeatherWidget />)
    // Immediately after mount the fetch is in flight, so no retry button yet.
    expect(screen.queryByRole('button', { name: /ลองอีกครั้ง/ })).toBeNull()
  })
})