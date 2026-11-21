import React from 'react';
import { AlertCircle, Inbox, Loader2, RotateCcw, type LucideIcon } from 'lucide-react';

export interface WidgetStateProps {
  kind: 'error' | 'empty' | 'loading';
  title: string;
  description?: string;
  onRetry?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export function WidgetState({
  kind,
  title,
  description,
  onRetry,
  icon: CustomIcon,
  className = '',
}: WidgetStateProps) {
  const isError = kind === 'error';
  const isLoading = kind === 'loading';

  // Default icons per kind
  const Icon = CustomIcon || (isError ? AlertCircle : isLoading ? Loader2 : Inbox);

  const iconBgClass = isError
    ? 'bg-[var(--danger-soft)] text-[var(--danger-ink)]'
    : isLoading
    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
    : 'bg-[var(--surface-grouped)] text-[var(--ink-muted)]';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-busy={isLoading ? 'true' : undefined}
      className={`flex h-full min-h-[140px] flex-col items-center justify-center gap-2.5 rounded-apple-lg p-5 text-center transition-all ${className}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget ${iconBgClass}`}>
        <Icon size={20} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center gap-0.5 max-w-[260px]">
        <h4 className="text-[14px] font-semibold tracking-tight text-[var(--ink)]">
          {title}
        </h4>
        {description && (
          <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {isError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-apple-md px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft-hover)] transition-all active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>ลองใหม่</span>
        </button>
      )}
    </div>
  );
}
