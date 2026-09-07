export interface HolidayItem {
  id: string
  dayOfWeek: string
  day: number
  month: number // 1-12
  monthName: string
  year: number
  title: string
  description?: string
}

export const THAI_HOLIDAYS_2026: HolidayItem[] = [
  { id: 'h-1', dayOfWeek: 'วันพฤหัสบดี', day: 1, month: 1, monthName: 'มกราคม', year: 2026, title: 'วันขึ้นปีใหม่' },
  { id: 'h-2', dayOfWeek: 'วันอังคาร', day: 3, month: 3, monthName: 'มีนาคม', year: 2026, title: 'วันมาฆบูชา' },
  { id: 'h-3', dayOfWeek: 'วันจันทร์', day: 6, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันจักรี' },
  { id: 'h-4', dayOfWeek: 'วันจันทร์', day: 13, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันสงกรานต์' },
  { id: 'h-5', dayOfWeek: 'วันอังคาร', day: 14, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันสงกรานต์' },
  { id: 'h-6', dayOfWeek: 'วันพุธ', day: 15, month: 4, monthName: 'เมษายน', year: 2026, title: 'วันสงกรานต์' },
  { id: 'h-7', dayOfWeek: 'วันศุกร์', day: 1, month: 5, monthName: 'พฤษภาคม', year: 2026, title: 'วันแรงงานแห่งชาติ' },
  { id: 'h-8', dayOfWeek: 'วันจันทร์', day: 4, month: 5, monthName: 'พฤษภาคม', year: 2026, title: 'วันฉัตรมงคล' },
  { id: 'h-9', dayOfWeek: 'วันพุธ', day: 3, month: 6, monthName: 'มิถุนายน', year: 2026, title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี' },
  { id: 'h-10', dayOfWeek: 'วันอังคาร', day: 28, month: 7, monthName: 'กรกฎาคม', year: 2026, title: 'วันเฉลิมพระชนมพรรษาพระเจ้าอยู่หัว' },
  { id: 'h-11', dayOfWeek: 'วันพุธ', day: 29, month: 7, monthName: 'กรกฎาคม', year: 2026, title: 'วันอาสาฬหบูชา' },
  { id: 'h-12', dayOfWeek: 'วันพุธ', day: 12, month: 8, monthName: 'สิงหาคม', year: 2026, title: 'วันแม่แห่งชาติ', description: 'วันคล้ายวันพระราชสมภพ สมเด็จพระบรมราชินีนาถในรัชกาลที่ 9' },
  { id: 'h-13', dayOfWeek: 'วันอังคาร', day: 13, month: 10, monthName: 'ตุลาคม', year: 2026, title: 'วันนวมินทรมหาราช', description: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระปรมินทรมหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร' },
  { id: 'h-14', dayOfWeek: 'วันศุกร์', day: 23, month: 10, monthName: 'ตุลาคม', year: 2026, title: 'วันปิยมหาราช' },
  { id: 'h-15', dayOfWeek: 'วันจันทร์', day: 7, month: 12, monthName: 'ธันวาคม', year: 2026, title: 'ชดเชยวันพ่อแห่งชาติ' },
  { id: 'h-16', dayOfWeek: 'วันพฤหัสบดี', day: 10, month: 12, monthName: 'ธันวาคม', year: 2026, title: 'วันรัฐธรรมนูญ' },
  { id: 'h-17', dayOfWeek: 'วันพฤหัสบดี', day: 31, month: 12, monthName: 'ธันวาคม', year: 2026, title: 'วันสิ้นปี' },
]

export interface HolidayWithDiff extends HolidayItem {
  dateObj: Date
  daysLeft: number
  isPast: boolean
  isToday: boolean
  isUpcoming: boolean
}

export function getHolidaysWithDiff(referenceDate: Date = new Date()): HolidayWithDiff[] {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  return THAI_HOLIDAYS_2026.map((h) => {
    const holidayDate = new Date(h.year, h.month - 1, h.day)
    const diffTime = holidayDate.getTime() - today.getTime()
    const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24))
    return {
      ...h,
      dateObj: holidayDate,
      daysLeft,
      isPast: daysLeft < 0,
      isToday: daysLeft === 0,
      isUpcoming: daysLeft > 0,
    }
  })
}
