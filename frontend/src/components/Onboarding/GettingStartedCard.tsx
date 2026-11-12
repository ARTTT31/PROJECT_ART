'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Lightbulb, Search, Sparkles, X } from 'lucide-react';
import type { AuthUser } from '@/types';
import { openCommandPalette } from '@/components/Layout/CommandPalette';

const DISMISS_KEY = 'art_onboarding_dismissed';
const PALETTE_KEY = 'art_onboarding_palette';

function quickLinkCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * A short first-run checklist for an account that has not set anything up yet.
 *
 * Steps are derived from real state (quick links, notification permission,
 * whether the palette was opened), not made-up checkboxes, so finishing a step
 * in the app ticks it here. Dismissal is per browser and reversible only by
 * clearing site data — the card never nags a returning user.
 */
export default function GettingStartedCard({ user }: { user: AuthUser }) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [paletteTried, setPaletteTried] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    setPaletteTried(localStorage.getItem(PALETTE_KEY) === '1');
    setNotificationsGranted(
      typeof Notification !== 'undefined' && Notification.permission === 'granted',
    );
    setReady(true);
  }, []);

  if (!ready || dismissed) return null;

  const linksDone = quickLinkCount(user.quick_links) > 0;
  const steps = [
    {
      id: 'links',
      done: linksDone,
      icon: <Sparkles size={15} aria-hidden="true" />,
      title: 'เพิ่มทางลัดที่ใช้บ่อย',
      description: 'เว็บที่คุณเปิดทุกวันจะอยู่บนแถบด้านข้าง',
      action: (
        <Link
          href="/profile"
          className="text-[12px] font-bold text-[var(--accent-text)] hover:underline"
        >
          ไปที่โปรไฟล์
        </Link>
      ),
    },
    {
      id: 'notifications',
      done: notificationsGranted,
      icon: <Bell size={15} aria-hidden="true" />,
      title: 'เปิดการแจ้งเตือน',
      description: 'รับแจ้งเตือนวันหยุด ราคาน้ำมัน และอากาศ',
      action: (
        <Link
          href="/notifications"
          className="text-[12px] font-bold text-[var(--accent-text)] hover:underline"
        >
          ตั้งค่า
        </Link>
      ),
    },
    {
      id: 'palette',
      done: paletteTried,
      icon: <Search size={15} aria-hidden="true" />,
      title: 'ลองค้นหาด้วย Ctrl K',
      description: 'กระโดดไปหน้า โน้ต หรือรายการติดตามได้ทันที',
      action: (
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(PALETTE_KEY, '1');
            setPaletteTried(true);
            openCommandPalette();
          }}
          className="text-[12px] font-bold text-[var(--accent-text)] hover:underline"
        >
          เปิดค้นหา
        </button>
      ),
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  if (doneCount === steps.length) return null;

  return (
    <section
      aria-labelledby="getting-started-heading"
      className="mb-6 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-apple-md bg-[var(--accent-soft)] text-[var(--accent-text)] ring-1 ring-[var(--accent-ring)]">
            <Lightbulb size={17} aria-hidden="true" />
          </div>
          <div>
            <h2
              id="getting-started-heading"
              className="text-[15px] font-bold tracking-tight text-[var(--ink)]"
            >
              เริ่มต้นใช้งานใน 3 ขั้น
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              ทำเสร็จแล้ว {doneCount}/{steps.length} ขั้น
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
          aria-label="ไม่ต้องแสดงคำแนะนำการเริ่มต้นอีก"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-all hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-4 grid gap-2 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-start gap-2.5 rounded-apple-widget border p-3 ${
              step.done
                ? 'border-[var(--hairline-soft)] bg-[var(--surface-subtle)]'
                : 'border-[var(--hairline)] bg-[var(--surface)]'
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                step.done
                  ? 'bg-[var(--success-soft)] text-[var(--success-ink)]'
                  : 'bg-[var(--surface-grouped)] text-[var(--ink-secondary)]'
              }`}
            >
              {step.done ? <Check size={13} aria-hidden="true" /> : step.icon}
            </span>
            <div className="min-w-0">
              <p
                className={`text-[13px] font-semibold ${
                  step.done ? 'text-[var(--ink-secondary)] line-through' : 'text-[var(--ink)]'
                }`}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]">
                {step.description}
              </p>
              {!step.done && <div className="mt-1.5">{step.action}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
