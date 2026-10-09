/**
 * Return appropriate Thai greeting based on the hour of the day (0-23).
 *
 * Time ranges:
 * - 05:00 - 11:59: สวัสดีตอนเช้า (Morning)
 * - 12:00 - 12:59: สวัสดีตอนเที่ยง (Noon)
 * - 13:00 - 15:59: สวัสดีตอนบ่าย (Afternoon, 1 PM - 3 PM)
 * - 16:00 - 18:59: สวัสดีตอนเย็น (Evening, 4 PM - 6 PM)
 * - 19:00 - 21:59: สวัสดีตอนค่ำ (Night, 7 PM - 9 PM)
 * - 22:00 - 04:59: ราตรีสวัสดิ์ (Late Night)
 */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'สวัสดีตอนเช้า'
  if (hour >= 12 && hour < 13) return 'สวัสดีตอนเที่ยง'
  if (hour >= 13 && hour < 16) return 'สวัสดีตอนบ่าย'
  if (hour >= 16 && hour < 19) return 'สวัสดีตอนเย็น'
  if (hour >= 19 && hour < 22) return 'สวัสดีตอนค่ำ'
  return 'ราตรีสวัสดิ์'
}
