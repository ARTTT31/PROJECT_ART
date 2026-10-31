'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional heading this option is listed under. */
  group?: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name — also what tests query by. */
  ariaLabel: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** `sm` for widget toolbars, `md` for page-level filters and forms. */
  size?: 'sm' | 'md';
  /** Extra classes for the trigger (width, spacing). */
  className?: string;
}

const MENU_MAX_HEIGHT = 288;

/**
 * A dropdown drawn by us instead of the browser's own popup.
 *
 * Native `<select>` menus cannot be styled: they render as an OS list with a
 * blue highlight, which looked out of place next to the rest of the UI. This is
 * a real dropdown (button + listbox) with the same keyboard behaviour, rendered
 * in a portal so it is never clipped by a card's `overflow-hidden`.
 */
export default function Select({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  placeholder = 'เลือก…',
  disabled = false,
  size = 'sm',
  className = '',
}: SelectProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const selectable = useMemo(() => options.filter((option) => !option.disabled), [options]);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setActive(-1);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeUp = spaceBelow < MENU_MAX_HEIGHT && rect.top > spaceBelow;

    setPlacement({
      left: Math.min(rect.left, Math.max(8, window.innerWidth - Math.max(rect.width, 200) - 8)),
      width: Math.max(rect.width, 180),
      ...(placeUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
    setOpen(true);
    setActive(Math.max(0, selectable.findIndex((option) => option.value === value)));
  }, [disabled, selectable, value]);

  // Close on outside click, Escape, scroll or resize: the menu is positioned
  // once, so a scroll would otherwise leave it floating away from its trigger.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close(false);
    };
    // Scrolling the page would leave the menu floating away from its trigger,
    // but scrolling inside the menu itself must not close it.
    const onScroll = (event: Event) => {
      const target = event.target;
      if (menuRef.current && target instanceof Node && menuRef.current.contains(target)) return;
      close(false);
    };
    const onResize = () => close(false);

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  // Move focus into the list so the arrow keys work without a stray Tab.
  useEffect(() => {
    if (open) menuRef.current?.focus({ preventScroll: true });
  }, [open]);

  const commit = (option: SelectOption) => {
    onChange(option.value);
    close();
  };

  const move = (delta: number) => {
    if (selectable.length === 0) return;
    setActive((current) => {
      const next = current + delta;
      if (next < 0) return selectable.length - 1;
      if (next >= selectable.length) return 0;
      return next;
    });
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(selectable.length - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = selectable[active];
        if (option) commit(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        break;
    }
  };

  const triggerSize =
    size === 'sm'
      ? 'rounded-[10px] px-2.5 py-[7px] text-[12px]'
      : 'rounded-[12px] px-3 py-2 text-[13px]';

  // Grouping is derived from the option order, so a caller only sets `group`.
  const groups = useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const option of options) {
      const key = option.group ?? '';
      const list = map.get(key);
      if (list) list.push(option);
      else map.set(key, [option]);
    }
    return [...map.entries()];
  }, [options]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            if (!open) {
              event.preventDefault();
              openMenu();
            }
          }
        }}
        className={`inline-flex min-w-0 items-center justify-between gap-1.5 border border-[var(--hairline)] bg-[var(--surface)] text-left font-medium text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:border-[var(--hairline-strong)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)] focus-visible:border-[var(--accent-border)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${triggerSize} ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-[var(--ink-tertiary)]'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 15}
          strokeWidth={2.4}
          aria-hidden="true"
          className={`shrink-0 text-[var(--ink-tertiary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        placement &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            style={{
              position: 'fixed',
              left: placement.left,
              width: placement.width,
              top: placement.top,
              bottom: placement.bottom,
              maxHeight: MENU_MAX_HEIGHT,
            }}
            className="z-[70] overflow-y-auto overscroll-contain rounded-[12px] border border-[var(--hairline)] bg-[var(--glass-95)] p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] outline-hidden backdrop-blur-xl"
          >
            {groups.map(([group, groupOptions]) => (
              <div key={group || 'default'} role="group" aria-label={group || undefined}>
                {group && (
                  <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                    {group}
                  </div>
                )}
                {groupOptions.map((option) => {
                  const isSelected = option.value === value;
                  const isActive = selectable.indexOf(option) === active;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onMouseEnter={() => {
                        const index = selectable.indexOf(option);
                        if (index >= 0) setActive(index);
                      }}
                      onClick={() => commit(option)}
                      className={`flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-[7px] text-left text-[12.5px] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                        isActive && !option.disabled ? 'bg-[var(--accent-soft)]' : ''
                      } ${isSelected ? 'font-semibold text-[var(--accent-text)]' : 'text-[var(--ink)]'}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <Check size={13} strokeWidth={3} aria-hidden="true" className="shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
