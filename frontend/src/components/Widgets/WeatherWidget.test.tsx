import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import WeatherWidget from './WeatherWidget'

/**
 * Regression cover for the production incident where Open-Meteo returned 429 and
 * the widget rendered a tall, mostly-empty card in the dashboard grid.
 */

/**
 * Let the mount effect's rejected request settle.
 *
 * The effect dispatches `setError` / `setLoading` from a promise callback, so a
 * test that asserts synchronously leaves those updates to land after the test has
 * finished — React reports that as "An update to WeatherWidget inside a test was
 * not wrapped in act(...)". Flushing inside `act` keeps the run clean and stops
 * the warnings from masking real failures.
 */
async function flushPendingUpdates() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

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

    await flushPendingUpdates()
  })

  it('still shows the widget title so the card is identifiable', async () => {
    render(<WeatherWidget />)

    await waitFor(() => expect(screen.getByText('สภาพอากาศ & PM 2.5')).toBeTruthy())

    await flushPendingUpdates()
  })

  it('lets the user retry', async () => {
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

    render(<WeatherWidget />)
    const retry = await screen.findByRole('button', { name: /ลองอีกครั้ง/ })
    const before = spy.mock.calls.length

    // fireEvent (unlike a bare .click()) dispatches inside act(), so the click's
    // synchronous state updates are not reported as unwrapped.
    fireEvent.click(retry)

    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before))

    await flushPendingUpdates()
  })

  it('shows no retry affordance while the request is still in flight', async () => {
    render(<WeatherWidget />)

    // Immediately after mount the request has not settled, so the card is still
    // in its loading state — there must be no error affordance yet.
    expect(screen.queryByRole('button', { name: /ลองอีกครั้ง/ })).toBeNull()

    await flushPendingUpdates()

    // ...and it appears only once the failure has actually been handled.
    expect(screen.getByRole('button', { name: /ลองอีกครั้ง/ })).toBeTruthy()
  })
})

/**
 * Cached data older than the 20-minute TTL: the widget hydrates from it and then
 * refreshes, which is the state production was in when Open-Meteo answered 429.
 */
function seedStaleCache() {
  localStorage.setItem(
    'artWeatherCacheV7',
    JSON.stringify({
      savedAt: Date.now() - 30 * 60_000,
      cityId: 'bkk',
      cityName: 'กรุงเทพฯ',
      lat: 13.7563,
      lon: 100.5018,
      weather: {
        currentTemp: 27,
        apparentTemp: 30,
        humidity: 88,
        windSpeed: 7,
        weatherCode: 61,
        tempMax: 32,
        tempMin: 25,
        rainProb: 40,
        hourlyForecast: [],
      },
      airQuality: { pm25: 6.8, pm10: 12, usAqi: 71 },
    }),
  )
}

describe('WeatherWidget — refresh failure with data already on screen', () => {
  it('keeps the cached forecast when only the forecast endpoint fails', async () => {
    seedStaleCache()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: unknown) => {
        if (String(url).includes('/weather/forecast')) {
          return Promise.resolve({ ok: false, status: 502, json: async () => ({}) })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ current: { pm2_5: 9.1, pm10: 15, us_aqi: 45 } }),
        })
      }),
    )

    render(<WeatherWidget />)

    // The half that succeeded is taken; the half that failed stands in with cache.
    await waitFor(() => expect(screen.getByText(/แสดงข้อมูลล่าสุดที่มีอยู่/)).toBeTruthy())

    expect(screen.getByText('27°')).toBeTruthy()
    // A widget that still has data must not claim it is broken.
    expect(screen.queryByText(/เกิดข้อผิดพลาดในการโหลดข้อมูลสภาพอากาศ/)).toBeNull()

    await flushPendingUpdates()
  })

  it('does not raise the alarm when the whole refresh fails but cache exists', async () => {
    seedStaleCache()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Upstream provider returned HTTP 429')),
    )

    render(<WeatherWidget />)

    await waitFor(() => expect(screen.getByText(/กำลังแสดงข้อมูลเดิม/)).toBeTruthy())

    expect(screen.getByText('27°')).toBeTruthy()
    expect(screen.queryByText(/เกิดข้อผิดพลาดในการโหลดข้อมูลสภาพอากาศ/)).toBeNull()

    await flushPendingUpdates()
  })
})