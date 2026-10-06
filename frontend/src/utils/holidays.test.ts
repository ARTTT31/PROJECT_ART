import { describe, it, expect } from 'vitest'

import { THAI_HOLIDAYS_2026, getHolidaysWithDiff } from './holidays'

/**
 * The widget and the notification bell both derive their "upcoming holiday"
 * information from these helpers, so the countdown flags and the year handling
 * are what the dashboard actually depends on.
 */

describe('getHolidaysWithDiff', () => {
  it('resolves the calendar from the reference year, not a hardcoded one', () => {
    const holidays = getHolidaysWithDiff(new Date(2027, 5, 1))

    expect(holidays.length).toBeGreaterThan(0)
    expect(holidays.every((holiday) => holiday.year === 2027)).toBe(true)
  })

  it('returns nothing for a year whose calendar has not been confirmed', () => {
    // Moveable Buddhist holidays must never be guessed, so an unknown year is
    // empty rather than approximated.
    expect(getHolidaysWithDiff(new Date(2030, 0, 1))).toEqual([])
  })

  it('returns the known holidays for 2026 in chronological order', () => {
    const holidays = getHolidaysWithDiff(new Date(2026, 0, 2))

    expect(holidays.map((holiday) => holiday.id)).toContain('2026-01-01')
    expect(holidays.map((holiday) => holiday.id)).toContain('2026-12-31')

    const dates = holidays.map((holiday) => holiday.dateObj.getTime())
    expect(dates).toEqual([...dates].sort((a, b) => a - b))
  })

  it('flags a holiday that falls on the reference day', () => {
    const holidays = getHolidaysWithDiff(new Date(2026, 0, 1))
    const newYear = holidays.find((holiday) => holiday.id === '2026-01-01')

    expect(newYear).toBeDefined()
    expect(newYear?.daysLeft).toBe(0)
    expect(newYear?.isToday).toBe(true)
    expect(newYear?.isPast).toBe(false)
    expect(newYear?.isUpcoming).toBe(false)
  })

  it('marks later holidays as upcoming and earlier ones as past', () => {
    const holidays = getHolidaysWithDiff(new Date(2026, 0, 2))

    const newYear = holidays.find((holiday) => holiday.id === '2026-01-01')
    const songkran = holidays.find((holiday) => holiday.id === '2026-04-13')

    expect(newYear?.isPast).toBe(true)
    expect(newYear?.daysLeft).toBeLessThan(0)
    expect(songkran?.isUpcoming).toBe(true)
    expect(songkran?.daysLeft).toBeGreaterThan(0)
  })

  it('ignores the time of day in the reference date', () => {
    const morning = getHolidaysWithDiff(new Date(2026, 3, 13, 1, 5, 0))
    const night = getHolidaysWithDiff(new Date(2026, 3, 13, 23, 55, 0))

    expect(morning.map((holiday) => holiday.daysLeft)).toEqual(
      night.map((holiday) => holiday.daysLeft)
    )
    expect(morning.find((holiday) => holiday.id === '2026-04-13')?.isToday).toBe(true)
  })

  it('labels every entry with a Thai weekday and month', () => {
    const holidays = getHolidaysWithDiff(new Date(2026, 0, 2))

    for (const holiday of holidays) {
      expect(holiday.dayOfWeek.length).toBeGreaterThan(0)
      expect(holiday.monthName.length).toBeGreaterThan(0)
      expect(holiday.title.length).toBeGreaterThan(0)
    }

    // The labels must agree with the locale's own formatting for that date.
    const expected = new Intl.DateTimeFormat('th-TH', { weekday: 'long' }).format(
      holidays[0].dateObj
    )
    expect(holidays[0].dayOfWeek).toBe(expected)
  })
})

describe('THAI_HOLIDAYS_2026', () => {
  it('uses the ISO date as the id and never reports a wrong year', () => {
    expect(THAI_HOLIDAYS_2026.length).toBeGreaterThan(0)

    for (const holiday of THAI_HOLIDAYS_2026) {
      expect(holiday.id).toBe(
        `${holiday.year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`
      )
      expect(holiday.year).toBe(2026)
    }
  })
})
