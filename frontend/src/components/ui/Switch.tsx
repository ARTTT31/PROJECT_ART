'use client';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — a switch has no visible text of its own. */
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Apple switch (51 × 31 with a 27px knob). Use this for an on/off setting
 * instead of a clickable row or a checkbox, which is what iOS does.
 */
export function Switch({ checked, onChange, label, disabled = false, id, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        // `small-control` opts out of the global 24×44px button target in
        // globals.css; that rule also sets `justify-content: center`, which
        // pushed the flex knob to the middle of the track and made it hang
        // out of the right edge when checked.
        'small-control relative inline-flex h-[31px] w-[51px] shrink-0 rounded-full',
        'transition-colors duration-apple-2 ease-apple',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]',
        'disabled:opacity-40',
        checked ? 'bg-[var(--success)]' : 'bg-[var(--surface-chip)] ring-1 ring-[var(--hairline)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          // Positioned against the track, not centred by the button's flex
          // context, so the 22px travel always lands 2px from the far edge.
          'pointer-events-none absolute top-[2px] left-0 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)]',
          'transition-transform duration-apple-2 ease-apple-spring',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        ].join(' ')}
      />
    </button>
  );
}

export default Switch;
