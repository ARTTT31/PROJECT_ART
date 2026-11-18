'use client';

import { useCallback, useRef, useState } from 'react';
import { StepUpDialog } from './StepUpDialog';

/**
 * Bridge between an API that answered `step_up_required` and a dialog.
 *
 * ```tsx
 * const { promptStepUp, stepUpDialog } = useStepUp();
 * const ok = await promptStepUp();  // true once the code verified
 * ```
 *
 * Render `stepUpDialog` once in the component that owns the action; a second
 * prompt while one is open settles the first as cancelled, so two pending
 * callers can never both retry on the same verification.
 */
export function useStepUp() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const promptStepUp = useCallback(() => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setOpen(false);
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(ok);
  }, []);

  const stepUpDialog = (
    <StepUpDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
      onVerified={() => settle(true)}
    />
  );

  return { promptStepUp, stepUpDialog };
}
