'use client';

import { useRef } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "ตัวกรองประวัติ". */
  label: string;
  /** Stretch to the container width with equal segments. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * Apple segmented control: a single track with one raised thumb.
 *
 * Replaces the hand-rolled variations that used aria-pressed toggles in some
 * places and radio cards in others. Arrow keys move the selection, which is what
 * a native control does.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAt = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const last = options.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectAt(index === last ? 0 : index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectAt(index === 0 ? last : index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectAt(last);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={[
        'items-center gap-0.5 rounded-full bg-[var(--surface-chip)] p-0.5',
        fullWidth ? 'flex w-full' : 'inline-flex',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={[
              'inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-apple-footnote font-semibold',
              'transition-[color,background-color,box-shadow,transform] duration-apple-1 ease-apple active:scale-[0.97]',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              fullWidth ? 'min-w-0 flex-1' : '',
              selected
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
