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
            'inline-flex h-9 min-w-10 items-center justify-center rounded-full px-3 text-xs font-extrabold transition-colors',
            isActive
              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.25)]'
              : 'text-slate-600 hover:bg-white hover:text-slate-900',
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
