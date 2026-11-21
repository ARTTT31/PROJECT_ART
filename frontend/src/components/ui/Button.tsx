import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface BaseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

type StandardButtonProps = BaseButtonProps & {
  iconOnly?: false;
};

type IconOnlyButtonProps = BaseButtonProps & {
  iconOnly: true;
  'aria-label': string;
};

export type ButtonProps = StandardButtonProps | IconOnlyButtonProps;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border-transparent shadow-xs',
  secondary:
    'bg-[var(--surface-grouped)] text-[var(--ink)] hover:bg-[var(--surface)] border-[var(--hairline)]',
  ghost:
    'bg-transparent text-[var(--ink)] hover:bg-[var(--surface-grouped)] border-transparent',
  destructive:
    'bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] border-transparent',
  outline:
    'bg-transparent text-[var(--ink)] hover:bg-[var(--surface-grouped)] border-[var(--hairline)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[32px] px-3 py-1 text-xs gap-1.5',
  md: 'min-h-[40px] px-4 py-2 text-sm gap-2',
  lg: 'min-h-[48px] px-5 py-2.5 text-base gap-2.5',
  icon: 'min-h-[40px] min-w-[40px] p-2 aspect-square justify-center',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  pill = false,
  loading = false,
  iconOnly = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ref,
  ...props
}: ButtonProps) {
  const actualSize = iconOnly && size === 'md' ? 'icon' : size;
  const radiusClass = pill ? 'rounded-full' : 'rounded-apple-md';

  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      className={`inline-flex items-center justify-center font-medium border transition-all duration-150 select-none ${radiusClass} ${variantClasses[variant]} ${sizeClasses[actualSize]} ${
        isDisabled
          ? 'opacity-50 cursor-not-allowed pointer-events-none'
          : 'cursor-pointer active:scale-[0.95]'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={actualSize === 'sm' ? 14 : 16} className="animate-spin shrink-0" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
