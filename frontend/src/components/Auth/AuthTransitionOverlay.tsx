'use client';

import Image from 'next/image';
import { Check, Loader2 } from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';

/**
 * Full-screen hand-off shown while a session transition completes
 * (signing in, signing up, signing out), so the flow never looks like a jump
 * cut between two pages. Self-contained Tailwind + tokens: it renders from the
 * dashboard and from the auth pages alike.
 */
export default function AuthTransitionOverlay({
  title,
  subtitle,
  tone = 'loading',
}: {
  title: string;
  subtitle?: string;
  tone?: 'loading' | 'success';
}) {
  const { companyName, brandLogoUrl } = useBranding();
  const logoSrc = brandLogoUrl || '/art-workspace-mark.svg';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fade-in fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--glass-80)] px-6 backdrop-blur-xl"
    >
      <div className="auth-transition-card w-full max-w-[330px] rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] px-7 py-8 text-center">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
          <Image
            src={logoSrc}
            alt={companyName}
            width={56}
            height={56}
            priority
            draggable={false}
            className="h-14 w-14 rounded-[16px] object-contain"
          />
          <span
            aria-hidden="true"
            className={`absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] ${
              tone === 'success'
                ? 'bg-[var(--success)] text-white'
                : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
            }`}
          >
            {tone === 'success' ? (
              <Check size={15} strokeWidth={3} />
            ) : (
              <Loader2 size={14} className="animate-spin" />
            )}
          </span>
        </div>

        <p className="mt-5 text-[16px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">{subtitle}</p>
        )}

        <div
          aria-hidden="true"
          className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-chip)]"
        >
          <span className="auth-progress-bar block h-full rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}
