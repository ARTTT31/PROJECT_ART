'use client'

import { Calendar } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'

const SHAREPOINT_LIST_URL =
  'https://absscoth-my.sharepoint.com/personal/pornchai_abss_co_th/Lists/Technical%20Support%20and%20IMACD%20Booking%20Schedule/AllItems.aspx?isDlg=1&FocusModeOff=1'

export default function CalendarWidget({
  width = 3,
  onResize,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedMonth: _selectedMonth,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMonthChange: _onMonthChange,
}: {
  width?: number
  onResize?: (size: number) => void
  selectedMonth?: Date
  onMonthChange?: (date: Date) => void
}) {
  return (
    <div
      className="flex h-full flex-col rounded-2xl bg-white ring-1 ring-black/[0.06]"
      role="region"
      aria-labelledby="calendar-title"
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 border-b border-black/[0.05] ${
        width === 2 ? 'px-4 py-3' : 'px-5 py-4'
      }`}>
        <div className="flex min-w-0 items-center gap-3">
          {/* Icon badge */}
          <div className={`flex shrink-0 items-center justify-center rounded-[14px] bg-[#f5f5f7] ${
            width === 2 ? 'h-8 w-8' : 'h-10 w-10'
          }`}>
            <Calendar
              className={`text-[#1d1d1f] ${width === 2 ? 'h-4 w-4' : 'h-5 w-5'}`}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h3
              id="calendar-title"
              className={`font-bold tracking-tight text-[#1d1d1f] ${
                width === 2 ? 'text-[13px]' : 'text-[15px]'
              }`}
            >
              ตารางงาน SharePoint
            </h3>
            <p className={`text-[#6e6e73] ${width === 2 ? 'text-[11px]' : 'text-xs'}`}>
              Technical Support &amp; IMACD Booking Schedule
            </p>
          </div>
        </div>

        {onResize && <WidgetSizeToggle value={width} onChange={onResize} />}
      </div>

      {/* SharePoint iframe */}
      <div className="relative flex-1 overflow-hidden rounded-b-2xl">
        <iframe
          src={SHAREPOINT_LIST_URL}
          title="Technical Support and IMACD Booking Schedule"
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen"
          loading="lazy"
        />
      </div>
    </div>
  )
}
