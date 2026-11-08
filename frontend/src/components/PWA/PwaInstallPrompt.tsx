'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, Share, PlusSquare, X, Smartphone, Check } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';

export function PwaInstallPrompt() {
  const { isInstallable, isIOS, promptInstall, dismiss } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (!isInstallable) return null;

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'manual_ios') {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      {/* ── Mobile Floating Install Banner ────────────────────────────── */}
      <aside
        aria-label="แนะนำการติดตั้งแอป"
        className="fixed bottom-4 left-3 right-3 z-40 mx-auto max-w-md transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
      >
        <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)]/95 p-3.5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[var(--surface-grouped)] ring-1 ring-[var(--hairline)]">
              <Image
                src="/branding-icon?size=192"
                alt="ART Workspace"
                width={44}
                height={44}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[var(--ink)] leading-tight">
                ติดตั้ง ART Workspace
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                เพิ่มลงหน้าจอหลักเพื่อเปิดใช้งานแบบเต็มจอ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-bold text-white shadow-2xs transition-all duration-150 hover:bg-[var(--accent-hover)] active:scale-[0.95]"
            >
              <Download size={13} aria-hidden="true" />
              <span>ติดตั้ง</span>
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="ปิดคำแนะนำการติดตั้ง"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--ink)] active:scale-[0.95]"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── iOS Step-by-Step Installation Modal ───────────────────────── */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm rounded-[18px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Smartphone size={24} aria-hidden="true" />
            </div>
            <DialogTitle className="text-center text-[16px] font-bold text-[var(--ink)]">
              วิธีติดตั้งบน iPhone / iPad
            </DialogTitle>
            <DialogDescription className="text-center text-[12px] text-[var(--ink-muted)]">
              ติดตั้งแอป ART Workspace ลงบนหน้าจอโฮมของคุณใน 3 ขั้นตอนง่าย ๆ
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 space-y-3 rounded-[14px] bg-[var(--surface-subtle)] p-3.5 border border-[var(--hairline)]">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                1
              </span>
              <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                แตะปุ่มแชร์{' '}
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)]">
                  <Share size={12} className="text-blue-500" aria-hidden="true" /> แชร์ (Share)
                </span>{' '}
                ที่แถบเมนูด้านล่างของ Safari
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                2
              </span>
              <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                เลื่อนลงมาแล้วเลือก{' '}
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)]">
                  <PlusSquare size={12} className="text-blue-500" aria-hidden="true" />{' '}
                  เพิ่มไปยังหน้าจอโฮม
                </span>
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                3
              </span>
              <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                แตะคำว่า <span className="font-bold text-[var(--ink)]">&ldquo;เพิ่ม&rdquo; (Add)</span>{' '}
                ที่มุมขวาบนของหน้าจอ
              </p>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full rounded-[11px] bg-[var(--accent)] py-2 text-[13px] font-bold text-white shadow-2xs transition-all hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Compact pill button for the Top Header bar (Header.tsx)
 */
export function PwaHeaderButton() {
  const { isInstallable, isIOS, promptInstall } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (!isInstallable) return null;

  const handleClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'manual_ios') {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="ติดตั้งแอป ART Workspace ลงในเครื่อง"
        aria-label="ติดตั้งแอป ART Workspace"
        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1 text-[12px] font-semibold text-[var(--ink)] shadow-2xs transition-all duration-150 hover:bg-[var(--surface-grouped)] hover:text-[var(--accent-text)] active:scale-[0.95]"
      >
        <Download size={13} className="text-[var(--accent-text)]" aria-hidden="true" />
        <span className="hidden xs:inline">ติดตั้งแอป</span>
      </button>

      {/* iOS Step-by-Step Installation Modal */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm rounded-[18px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <Smartphone size={24} aria-hidden="true" />
            </div>
            <DialogTitle className="text-center text-[16px] font-bold text-[var(--ink)]">
              วิธีติดตั้งบน iPhone / iPad
            </DialogTitle>
            <DialogDescription className="text-center text-[12px] text-[var(--ink-muted)]">
              ติดตั้งแอป ART Workspace ลงบนหน้าจอโฮมของคุณใน 3 ขั้นตอนง่าย ๆ
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 space-y-3 rounded-[14px] bg-[var(--surface-subtle)] p-3.5 border border-[var(--hairline)]">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                1
              </span>
              <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                แตะปุ่มแชร์{' '}
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)]">
                  <Share size={12} className="text-blue-500" aria-hidden="true" /> แชร์ (Share)
                </span>{' '}
                ที่แถบเมนูด้านล่างของ Safari
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                2
              </span>
              <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                เลื่อนลงมาแล้วเลือก{' '}
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-semibold text-[var(--ink)] ring-1 ring-[var(--hairline)]">
                  <PlusSquare size={12} className="text-blue-500" aria-hidden="true" />{' '}
                  เพิ่มไปยังหน้าจอโฮม
                </span>
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                3
              </span>
              <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                แตะคำว่า <span className="font-bold text-[var(--ink)]">&ldquo;เพิ่ม&rdquo; (Add)</span>{' '}
                ที่มุมขวาบนของหน้าจอ
              </p>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full rounded-[11px] bg-[var(--accent)] py-2 text-[13px] font-bold text-white shadow-2xs transition-all hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PwaInstallPrompt;
