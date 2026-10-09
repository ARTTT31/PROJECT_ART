import { describe, it, expect } from 'vitest'
import { getGreeting } from './greeting'

describe('getGreeting', () => {
  const makeDate = (hour: number, minute: number = 0) => {
    return new Date(2026, 9, 9, hour, minute)
  }

  it('returns "สวัสดีตอนเช้า" from 05:00 to 11:59', () => {
    expect(getGreeting(makeDate(5, 0))).toBe('สวัสดีตอนเช้า')
    expect(getGreeting(makeDate(8, 30))).toBe('สวัสดีตอนเช้า')
    expect(getGreeting(makeDate(11, 59))).toBe('สวัสดีตอนเช้า')
  })

  it('returns "สวัสดีตอนเที่ยง" from 12:00 to 12:59', () => {
    expect(getGreeting(makeDate(12, 0))).toBe('สวัสดีตอนเที่ยง')
    expect(getGreeting(makeDate(12, 30))).toBe('สวัสดีตอนเที่ยง')
    expect(getGreeting(makeDate(12, 59))).toBe('สวัสดีตอนเที่ยง')
  })

  it('returns "สวัสดีตอนบ่าย" from 13:00 to 15:59', () => {
    expect(getGreeting(makeDate(13, 0))).toBe('สวัสดีตอนบ่าย')
    expect(getGreeting(makeDate(14, 0))).toBe('สวัสดีตอนบ่าย')
    expect(getGreeting(makeDate(15, 59))).toBe('สวัสดีตอนบ่าย')
  })

  it('returns "สวัสดีตอนเย็น" from 16:00 to 18:59 (4 โมงเย็นถึง 6 โมงเย็น)', () => {
    expect(getGreeting(makeDate(16, 0))).toBe('สวัสดีตอนเย็น')
    expect(getGreeting(makeDate(16, 30))).toBe('สวัสดีตอนเย็น')
    expect(getGreeting(makeDate(17, 0))).toBe('สวัสดีตอนเย็น')
    expect(getGreeting(makeDate(18, 59))).toBe('สวัสดีตอนเย็น')
  })

  it('returns "สวัสดีตอนค่ำ" from 19:00 to 21:59', () => {
    expect(getGreeting(makeDate(19, 0))).toBe('สวัสดีตอนค่ำ')
    expect(getGreeting(makeDate(20, 30))).toBe('สวัสดีตอนค่ำ')
    expect(getGreeting(makeDate(21, 59))).toBe('สวัสดีตอนค่ำ')
  })

  it('returns "ราตรีสวัสดิ์" from 22:00 to 04:59', () => {
    expect(getGreeting(makeDate(22, 0))).toBe('ราตรีสวัสดิ์')
    expect(getGreeting(makeDate(23, 59))).toBe('ราตรีสวัสดิ์')
    expect(getGreeting(makeDate(0, 0))).toBe('ราตรีสวัสดิ์')
    expect(getGreeting(makeDate(3, 15))).toBe('ราตรีสวัสดิ์')
    expect(getGreeting(makeDate(4, 59))).toBe('ราตรีสวัสดิ์')
  })
})
