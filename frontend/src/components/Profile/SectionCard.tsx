'use client';

import React from 'react';

// ─────────────────────────────────────────────────────────────
// Section Card Component
// ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  iconRing: string;
  title: string;
  subtitle: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionCard({
  icon,
  iconBg,
  iconColor,
  iconRing,
  title,
  subtitle,
  badge,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-[18px] bg-white border border-black/[0.06] shadow-xs transition-all duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] bg-[#fafafc] px-5 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${iconBg} ${iconColor} ring-1 ${iconRing}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[#1d1d1f] leading-snug">
                {title}
              </h2>
              {badge && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#6e6e73] ring-1 ring-black/[0.06] shadow-2xs">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-[12px] leading-snug text-[#6e6e73] truncate max-w-xs sm:max-w-md">
              {subtitle}
            </p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Inset Text Field (iOS Grouped Style)
// ─────────────────────────────────────────────────────────────

interface InsetFieldProps {
  id?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  readOnly?: boolean;
  hint?: string;
}

export function InsetField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  trailing,
  required,
  autoComplete,
  readOnly,
  hint,
}: InsetFieldProps) {
  const inputId = id || `field-${label.replace(/[^a-zA-Z0-9ก-๙]/g, '-').toLowerCase()}`;

  return (
    <div>
      <div className="mb-1.5 ml-1 flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="block text-[12px] font-bold text-[#475569] cursor-pointer"
        >
          {label}
        </label>
        {hint && <span className="text-[11px] font-medium text-[#86868b]">{hint}</span>}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]">
          {icon}
        </span>
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          readOnly={readOnly}
          className={[
            'w-full rounded-[14px] py-3 text-[16px] sm:text-[14px] font-medium text-[#1d1d1f] placeholder:text-[#86868b] transition-all duration-150',
            readOnly
              ? 'bg-[#f2f2f7]/60 cursor-default select-text'
              : 'bg-[#f5f5f7] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0066cc] focus:shadow-xs',
            trailing ? '!pr-12' : '!pr-4',
          ].join(' ')}
          style={{ paddingLeft: '2.75rem' }}
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  );
}

export default SectionCard;
