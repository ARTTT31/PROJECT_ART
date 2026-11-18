'use client';

import { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { verifyStepUp } from '@/lib/api/stepUp';

/**
 * Asks for the 2FA code again before a dangerous action.
 *
 * The API refuses the action with `step_up_required`; the caller opens this
 * dialog, and a verified code is what turns the retry into a success. A wrong
 * code keeps the dialog open with the reason, like the login dialog.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCode('');
    setError('');
  };

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await verifyStepUp(trimmed);
      if (!result.ok) {
        setError(result.message || 'รหัสยืนยันไม่ถูกต้อง');
        setCode('');
        return;
      }
      reset();
      onVerified();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md focus:ring-0!">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-apple-widget bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[18px]">ยืนยันตัวตนอีกครั้ง</DialogTitle>
              <DialogDescription className="mt-1 text-[12.5px] leading-relaxed">
                รายการนี้เปลี่ยนความปลอดภัยของบัญชี กรุณากรอกรหัส 6 หลักจากแอป Authenticator
                หรือรหัสกู้คืนของคุณ
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(code);
          }}
        >
          <DialogBody className="space-y-3">
            <label htmlFor="step-up-code" className="sr-only">
              รหัสยืนยัน 6 หลัก หรือรหัสกู้คืน
            </label>
            <input
              id="step-up-code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              maxLength={11}
              value={code}
              onChange={(event) => {
                const value = event.target.value;
                setCode(value);
                // Six digits is a complete authenticator code; recovery codes
                // (10 characters) still use the button.
                if (/^\d{6}$/.test(value) && !busy) void submit(value);
              }}
              placeholder="123456 หรือ ABCDE-12345"
              disabled={busy}
              aria-invalid={Boolean(error)}
              className="w-full rounded-apple-widget bg-[var(--surface-grouped)] px-4 py-3 text-center text-[18px] font-bold tracking-[0.15em] text-[var(--ink)] placeholder:text-[15px] placeholder:font-medium placeholder:tracking-normal placeholder:text-[var(--ink-tertiary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
            />

            {error && (
              <p
                role="alert"
                className="flex items-start gap-1.5 rounded-apple-md bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-medium leading-relaxed text-[var(--danger)]"
              >
                <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={busy}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.97] disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>กำลังตรวจสอบ…</span>
                </>
              ) : (
                <>
                  <span>ยืนยัน</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default StepUpDialog;
