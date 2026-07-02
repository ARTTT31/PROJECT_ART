'use client'

import { Calendar } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'

const SHAREPOINT_LIST_URL =
  'https://absscoth-my.sharepoint.com/personal/pornchai_abss_co_th/Lists/Technical%20Support%20and%20IMACD%20Booking%20Schedule/AllItems.aspx?FocusModeOff=1'

export default function CalendarWidget({
  width = 3,
  onResize,
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  return (
    <div
      className="premium-card fade-in h-full flex flex-col"
      role="region"
      aria-labelledby="calendar-title"
    >
      {/* Header */}
      <div className={`widget-header ${width === 2 ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}>
        <div className="flex items-center justify-between w-full flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={`widget-header-icon primary flex-shrink-0 ${
                width === 2 ? 'p-1.5' : 'p-2'
              }`}
            >
              <Calendar
                className={`${width === 2 ? 'w-5 h-5' : 'w-6 h-6'}`}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <h3
                id="calendar-title"
                className={`font-semibold text-primary-700 ${
                  width === 2 ? 'text-base' : 'text-lg'
                }`}
              >
                ตารางงาน SharePoint
              </h3>
              <p className={`text-neutral-500 ${width === 2 ? 'text-xs' : 'text-sm'}`}>
                Technical Support &amp; IMACD Booking Schedule
              </p>
            </div>
          </div>

          {onResize && (
            <WidgetSizeToggle value={width} onChange={onResize} />
          )}
        </div>
      </div>

      {/* SharePoint iframe */}
      <div className="flex-1 relative overflow-hidden rounded-b-2xl">
        <iframe
          src={SHAREPOINT_LIST_URL}
          title="Technical Support and IMACD Booking Schedule"
          className="absolute inset-0 w-full h-full border-0"
          allow="fullscreen"
          loading="lazy"
        />
      </div>
    </div>
  )
}
