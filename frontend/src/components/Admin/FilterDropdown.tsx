'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { FilterOption } from './userManagementModel';

export default function FilterDropdown({
  ariaLabel,
  value,
  onChange,
  options,
  align = 'left',
  textOnly = false,
}: {
  ariaLabel: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  align?: 'left' | 'right';
  /** Render labels without option icons or a selection tick. */
  textOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-auto">
      {/* Visual Custom Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ minHeight: '42px', height: '42px', borderRadius: '9999px' }}
        className={`w-full sm:w-auto inline-flex items-center justify-between gap-2.5 rounded-full border px-4 text-[13px] font-bold transition-all active:scale-[0.98] ${
          isOpen
            ? 'border-[var(--accent)] bg-[var(--surface)] ring-2 ring-[var(--accent-ring)] text-[var(--ink)]'
            : value
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft-weak)] text-[var(--accent-text)] hover:bg-[var(--accent-soft)]'
              : 'border-[var(--hairline)] bg-[var(--surface-grouped)] text-[var(--ink)] hover:bg-[var(--surface-chip-2)]'
        }`}
      >
        <span className="inline-flex items-center gap-2 truncate">
          {!textOnly && selectedOption.icon}
          <span>{selectedOption.label}</span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--accent-text)]' : 'text-[var(--ink-tertiary)]'
          }`}
        />
      </button>

      {/* Floating Apple-Style Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute top-[calc(100%+6px)] z-50 min-w-[175px] max-w-[240px] overflow-hidden rounded-apple-lg border border-[var(--hairline)] bg-[var(--glass-95)] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0 sm:left-0' : 'left-0'
          }`}
        >
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-apple-widget px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'text-[var(--ink)] hover:bg-[var(--surface-grouped)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    {!textOnly && opt.icon}
                    <span>{opt.label}</span>
                  </span>
                  {!textOnly && isSelected && (
                    <Check size={14} className="shrink-0 text-[var(--accent-text)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accessible native select for test automation & screen readers */}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
