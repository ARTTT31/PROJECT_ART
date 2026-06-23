'use client'

import clsx from 'clsx'

interface WidgetSizeToggleProps {
  value: number
  onChange: (next: number) => void
  sizes?: number[]
  className?: string
}

/**
 * ปุ่มสลับขนาดวิดเจ็ต (มาตรฐานเดียวทั้งระบบ)
 * - ใช้เพื่อปรับขนาด M/L แบบสม่ำเสมอ
 */
export default function WidgetSizeToggle({
  value,
  onChange,
  sizes = [2, 3],
  className,
}: WidgetSizeToggleProps) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border border-white/50 bg-white/70 p-1 shadow-glass-sm backdrop-blur-md',
        className,
      )}
      role="group"
      aria-label="ปรับขนาดวิดเจ็ต"
    >
      {sizes.map((size) => {
      const label = size === 1 ? 'S' : size === 2 ? 'M' : size === 3 ? 'L' : String(size)
      const isActive = value === size
      return (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          aria-pressed={isActive}
          className={clsx(
            'art-chip-button min-h-9 min-w-10 px-3 text-xs',
            isActive
              ? 'is-active'
              : 'border-transparent bg-transparent shadow-none',
          )}
          title={size === 1 ? 'เล็ก (S)' : size === 2 ? 'กลาง (M)' : size === 3 ? 'ใหญ่ (L)' : `ขนาด ${size}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
