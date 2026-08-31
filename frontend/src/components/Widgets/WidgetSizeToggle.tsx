'use client'

import clsx from 'clsx'

interface WidgetSizeToggleProps {
  value: number
  onChange: (next: number) => void
  sizes?: number[]
  className?: string
}

/**
 * ปุ่มสลับขนาดวิดเจ็ต — Apple Design System v2.0
 * Container: white pill with ring-1 ring-black/[0.06]
 * Active:    bg-[#1d1d1f] text-white
 * Default:   text-[#6e6e73] hover:bg-[#f5f5f7]
 */
const sizeDescriptions: Record<number, string> = {
  1: 'ขนาดเล็ก (1 คอลัมน์)',
  2: 'ขนาดกลาง (2 คอลัมน์)',
  3: 'ขนาดใหญ่ (เต็มความกว้าง)',
}

export default function WidgetSizeToggle({
  value,
  onChange,
  sizes = [1, 2, 3],
  className,
}: WidgetSizeToggleProps) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full bg-white p-1 ring-1 ring-black/[0.06]',
        className,
      )}
      role="group"
      aria-label="ปรับขนาดวิดเจ็ต"
    >
      {sizes.map((size) => {
        const label = size === 1 ? 'S' : size === 2 ? 'M' : size === 3 ? 'L' : String(size)
        const isActive = value === size
        const description = sizeDescriptions[size] || `ขนาด ${size}`
        return (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            aria-pressed={isActive}
            aria-label={`ปรับเป็น${description}`}
            title={description}
            className={clsx(
              'min-h-7 min-w-7 rounded-full px-2.5 text-xs font-bold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1',
              isActive
                ? 'bg-[#1d1d1f] text-white shadow-sm'
                : 'bg-transparent text-[#475569] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
