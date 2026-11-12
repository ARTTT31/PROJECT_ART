import { getActiveLocale } from '@/lib/i18n/translate';

export interface HolidayItem {
  id: string;
  dayOfWeek: string;
  day: number;
  month: number; // 1-12
  monthName: string;
  year: number;
  title: string;
  /** English title for the bundled public holidays. */
  titleEn?: string;
  description?: string;
  /** English description for the bundled public holidays. */
  descriptionEn?: string;
}

type HolidayDefinition = Omit<
  HolidayItem,
  'id' | 'dayOfWeek' | 'day' | 'month' | 'monthName' | 'year'
> & { date: string };

// Keep confirmed calendars explicit: moveable Buddhist holidays must not be guessed.
const THAI_HOLIDAY_CALENDARS: Record<number, HolidayDefinition[]> = {
  2026: [
    { date: '2026-01-01', title: 'วันขึ้นปีใหม่', titleEn: "New Year's Day" },
    { date: '2026-03-03', title: 'วันมาฆบูชา', titleEn: 'Makha Bucha Day' },
    { date: '2026-04-06', title: 'วันจักรี', titleEn: 'Chakri Day' },
    { date: '2026-04-13', title: 'วันสงกรานต์', titleEn: 'Songkran Festival' },
    { date: '2026-04-14', title: 'วันสงกรานต์', titleEn: 'Songkran Festival' },
    { date: '2026-04-15', title: 'วันสงกรานต์', titleEn: 'Songkran Festival' },
    { date: '2026-05-01', title: 'วันแรงงานแห่งชาติ', titleEn: 'National Labour Day' },
    { date: '2026-05-04', title: 'วันฉัตรมงคล', titleEn: 'Coronation Day' },
    {
      date: '2026-06-03',
      title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
      titleEn: "Queen Suthida's Birthday",
    },
    {
      date: '2026-07-28',
      title: 'วันเฉลิมพระชนมพรรษาพระเจ้าอยู่หัว',
      titleEn: "King Maha Vajiralongkorn's Birthday",
    },
    { date: '2026-07-29', title: 'วันอาสาฬหบูชา', titleEn: 'Asahna Bucha Day' },
    {
      date: '2026-08-12',
      title: 'วันแม่แห่งชาติ',
      titleEn: "Mother's Day",
      description: 'วันคล้ายวันพระราชสมภพ สมเด็จพระบรมราชินีนาถในรัชกาลที่ 9',
      descriptionEn: "The birthday anniversary of Queen Sirikit, the Queen Mother",
    },
    {
      date: '2026-10-13',
      title: 'วันนวมินทรมหาราช',
      titleEn: 'King Bhumibol Memorial Day',
      description: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระปรมินทรมหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร',
      descriptionEn: 'The anniversary of the passing of King Bhumibol Adulyadej the Great',
    },
    { date: '2026-10-23', title: 'วันปิยมหาราช', titleEn: 'Chulalongkorn Day' },
    {
      date: '2026-12-07',
      title: 'ชดเชยวันพ่อแห่งชาติ',
      titleEn: "Father's Day (substitute)",
    },
    { date: '2026-12-10', title: 'วันรัฐธรรมนูญ', titleEn: 'Constitution Day' },
    { date: '2026-12-31', title: 'วันสิ้นปี', titleEn: "New Year's Eve" },
  ],
  2027: [
    { date: '2027-01-01', title: 'วันขึ้นปีใหม่', titleEn: "New Year's Day" },
    { date: '2027-02-22', title: 'ชดเชยวันมาฆบูชา', titleEn: 'Makha Bucha Day (substitute)' },
    { date: '2027-04-06', title: 'วันจักรี', titleEn: 'Chakri Day' },
    { date: '2027-04-13', title: 'วันสงกรานต์', titleEn: 'Songkran Festival' },
    { date: '2027-04-14', title: 'วันสงกรานต์', titleEn: 'Songkran Festival' },
    { date: '2027-04-15', title: 'วันสงกรานต์', titleEn: 'Songkran Festival' },
    {
      date: '2027-05-03',
      title: 'ชดเชยวันแรงงานแห่งชาติ',
      titleEn: 'National Labour Day (substitute)',
    },
    { date: '2027-05-04', title: 'วันฉัตรมงคล', titleEn: 'Coronation Day' },
    { date: '2027-05-20', title: 'วันวิสาขบูชา', titleEn: 'Visakha Bucha Day' },
    {
      date: '2027-06-03',
      title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
      titleEn: "Queen Suthida's Birthday",
    },
    {
      date: '2027-07-19',
      title: 'ชดเชยวันอาสาฬหบูชา',
      titleEn: 'Asahna Bucha Day (substitute)',
    },
    {
      date: '2027-07-28',
      title: 'วันเฉลิมพระชนมพรรษาพระเจ้าอยู่หัว',
      titleEn: "King Maha Vajiralongkorn's Birthday",
    },
    { date: '2027-08-12', title: 'วันแม่แห่งชาติ', titleEn: "Mother's Day" },
    { date: '2027-10-13', title: 'วันนวมินทรมหาราช', titleEn: 'King Bhumibol Memorial Day' },
    {
      date: '2027-10-25',
      title: 'ชดเชยวันปิยมหาราช',
      titleEn: 'Chulalongkorn Day (substitute)',
    },
    {
      date: '2027-12-06',
      title: 'ชดเชยวันพ่อแห่งชาติ',
      titleEn: "Father's Day (substitute)",
    },
    { date: '2027-12-10', title: 'วันรัฐธรรมนูญ', titleEn: 'Constitution Day' },
    { date: '2027-12-31', title: 'วันสิ้นปี', titleEn: "New Year's Eve" },
  ],
};

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', { weekday: 'long', month: 'long' });

function toHolidayItem(definition: HolidayDefinition): HolidayItem {
  const [year, month, day] = definition.date.split('-').map(Number);
  const parts = thaiDateFormatter.formatToParts(new Date(year, month - 1, day));
  return {
    id: definition.date,
    dayOfWeek: parts.find((part) => part.type === 'weekday')?.value ?? '',
    day,
    month,
    monthName: parts.find((part) => part.type === 'month')?.value ?? '',
    year,
    title: definition.title,
    titleEn: definition.titleEn,
    description: definition.description,
    descriptionEn: definition.descriptionEn,
  };
}

/** Display title for a bundled holiday, falling back to the Thai name. */
export function holidayTitle(item: Pick<HolidayItem, 'title' | 'titleEn'>): string {
  return getActiveLocale() === 'en' && item.titleEn ? item.titleEn : item.title;
}

/** Display description for a bundled holiday, falling back to the Thai text. */
export function holidayDescription(
  item: Pick<HolidayItem, 'description' | 'descriptionEn'>,
): string {
  return getActiveLocale() === 'en' && item.descriptionEn
    ? item.descriptionEn
    : item.description ?? '';
}

export const THAI_HOLIDAYS_2026 = THAI_HOLIDAY_CALENDARS[2026].map(toHolidayItem);

export interface HolidayWithDiff extends HolidayItem {
  dateObj: Date;
  daysLeft: number;
  isPast: boolean;
  isToday: boolean;
  isUpcoming: boolean;
}

export interface CompanyHolidayInput {
  date: string;
  title: string;
  description?: string;
}

/**
 * Merge the workspace calendar HR imported over the confirmed public list.
 *
 * The company document wins on a shared date: it is the one that says whether
 * this workplace is actually closed, and HR sometimes relabels a public day.
 */
export function mergeHolidayItems(
  year: number,
  company: CompanyHolidayInput[] = [],
): HolidayItem[] {
  const merged = new Map<string, HolidayDefinition>();
  for (const definition of THAI_HOLIDAY_CALENDARS[year] ?? []) {
    merged.set(definition.date, definition);
  }
  for (const item of company) {
    if (!item?.date || !item?.title) continue;
    if (!item.date.startsWith(`${year}-`)) continue;
    merged.set(item.date, {
      date: item.date,
      title: item.title,
      description: item.description,
    });
  }
  return Array.from(merged.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(toHolidayItem);
}

/** Add countdown fields to an already-built list (bundled, company or both). */
export function buildHolidayDiff(
  items: HolidayItem[],
  referenceDate: Date = new Date(),
): HolidayWithDiff[] {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  return items.map((holiday) => {
    const holidayDate = new Date(holiday.year, holiday.month - 1, holiday.day);
    const daysLeft = Math.round(
      (holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      ...holiday,
      dateObj: holidayDate,
      daysLeft,
      isPast: daysLeft < 0,
      isToday: daysLeft === 0,
      isUpcoming: daysLeft > 0,
    };
  });
}

export function getHolidaysWithDiff(referenceDate: Date = new Date()): HolidayWithDiff[] {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const definitions = THAI_HOLIDAY_CALENDARS[referenceDate.getFullYear()] ?? [];

  return definitions.map(toHolidayItem).map((holiday) => {
    const holidayDate = new Date(holiday.year, holiday.month - 1, holiday.day);
    const daysLeft = Math.round((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...holiday,
      dateObj: holidayDate,
      daysLeft,
      isPast: daysLeft < 0,
      isToday: daysLeft === 0,
      isUpcoming: daysLeft > 0,
    };
  });
}
