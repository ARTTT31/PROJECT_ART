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

type HolidayDefinition = Omit<HolidayItem, 'id' | 'dayOfWeek' | 'day' | 'month' | 'monthName' | 'year'> & { date: string }

// Keep confirmed calendars explicit: moveable Buddhist holidays must not be guessed.
const THAI_HOLIDAY_CALENDARS: Record<number, HolidayDefinition[]> = {
  2026: [
    { date: '2026-01-01', title: 'วันขึ้นปีใหม่' }, { date: '2026-03-03', title: 'วันมาฆบูชา' },
    { date: '2026-04-06', title: 'วันจักรี' }, { date: '2026-04-13', title: 'วันสงกรานต์' },
    { date: '2026-04-14', title: 'วันสงกรานต์' }, { date: '2026-04-15', title: 'วันสงกรานต์' },
    { date: '2026-05-01', title: 'วันแรงงานแห่งชาติ' }, { date: '2026-05-04', title: 'วันฉัตรมงคล' },
    { date: '2026-06-03', title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี' },
    { date: '2026-07-28', title: 'วันเฉลิมพระชนมพรรษาพระเจ้าอยู่หัว' }, { date: '2026-07-29', title: 'วันอาสาฬหบูชา' },
    { date: '2026-08-12', title: 'วันแม่แห่งชาติ', description: 'วันคล้ายวันพระราชสมภพ สมเด็จพระบรมราชินีนาถในรัชกาลที่ 9' },
    { date: '2026-10-13', title: 'วันนวมินทรมหาราช', description: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระปรมินทรมหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร' },
    { date: '2026-10-23', title: 'วันปิยมหาราช' }, { date: '2026-12-07', title: 'ชดเชยวันพ่อแห่งชาติ' },
    { date: '2026-12-10', title: 'วันรัฐธรรมนูญ' }, { date: '2026-12-31', title: 'วันสิ้นปี' },
  ],
  2027: [
    { date: '2027-01-01', title: 'วันขึ้นปีใหม่' }, { date: '2027-02-22', title: 'ชดเชยวันมาฆบูชา' },
    { date: '2027-04-06', title: 'วันจักรี' }, { date: '2027-04-13', title: 'วันสงกรานต์' },
    { date: '2027-04-14', title: 'วันสงกรานต์' }, { date: '2027-04-15', title: 'วันสงกรานต์' },
    { date: '2027-05-03', title: 'ชดเชยวันแรงงานแห่งชาติ' }, { date: '2027-05-04', title: 'วันฉัตรมงคล' },
    { date: '2027-05-20', title: 'วันวิสาขบูชา' },
    { date: '2027-06-03', title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี' },
    { date: '2027-07-19', title: 'ชดเชยวันอาสาฬหบูชา' }, { date: '2027-07-28', title: 'วันเฉลิมพระชนมพรรษาพระเจ้าอยู่หัว' },
    { date: '2027-08-12', title: 'วันแม่แห่งชาติ' }, { date: '2027-10-13', title: 'วันนวมินทรมหาราช' },
    { date: '2027-10-25', title: 'ชดเชยวันปิยมหาราช' }, { date: '2027-12-06', title: 'ชดเชยวันพ่อแห่งชาติ' },
    { date: '2027-12-10', title: 'วันรัฐธรรมนูญ' }, { date: '2027-12-31', title: 'วันสิ้นปี' },
  ],
}

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', { weekday: 'long', month: 'long' })

function toHolidayItem(definition: HolidayDefinition): HolidayItem {
  const [year, month, day] = definition.date.split('-').map(Number)
  const parts = thaiDateFormatter.formatToParts(new Date(year, month - 1, day))
  return {
    id: definition.date,
    dayOfWeek: parts.find((part) => part.type === 'weekday')?.value ?? '',
    day,
    month,
    monthName: parts.find((part) => part.type === 'month')?.value ?? '',
    year,
    title: definition.title,
    description: definition.description,
  }
}

export const THAI_HOLIDAYS_2026 = THAI_HOLIDAY_CALENDARS[2026].map(toHolidayItem)

export interface HolidayWithDiff extends HolidayItem {
  dateObj: Date
  daysLeft: number
  isPast: boolean
  isToday: boolean
  isUpcoming: boolean
}

export function getHolidaysWithDiff(referenceDate: Date = new Date()): HolidayWithDiff[] {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const definitions = THAI_HOLIDAY_CALENDARS[referenceDate.getFullYear()] ?? []

  return definitions.map(toHolidayItem).map((holiday) => {
    const holidayDate = new Date(holiday.year, holiday.month - 1, holiday.day)
    const daysLeft = Math.round((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return { ...holiday, dateObj: holidayDate, daysLeft, isPast: daysLeft < 0, isToday: daysLeft === 0, isUpcoming: daysLeft > 0 }
  })
}
