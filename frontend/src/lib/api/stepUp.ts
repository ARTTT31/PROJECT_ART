/**
 * Step-up re-verification (API side).
 *
 * Dangerous account actions answer `403` with
 * `{"detail": {"code": "step_up_required", ...}}` when the account has 2FA and
 * the second factor was not typed recently. The caller prompts for a code,
 * POSTs it here, and retries the same request once — the backend then sets a
 * short-lived `step_up` cookie bound to this session.
 */

import { apiMessage } from './apiMessage';
import { fetchWithAuth } from './fetchWithAuth';

export const STEP_UP_REQUIRED_CODE = 'step_up_required';
export const STEP_UP_ENDPOINT = '/api/v1/auth/step-up';

/** True when an error body asks for a fresh 2FA code. */
export function isStepUpRequired(body: unknown): boolean {
  const detail = (body as { detail?: { code?: unknown } | null } | null)?.detail;
  return detail?.code === STEP_UP_REQUIRED_CODE;
}

/** Send a live authenticator code or a recovery code. */
export async function verifyStepUp(
  code: string,
): Promise<{ ok: boolean; message?: string }> {
  const response = await fetchWithAuth(STEP_UP_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ code: code.trim() }),
  });
  if (response.ok) return { ok: true };

  const body = await response.json().catch(() => null);
  return { ok: false, message: apiMessage(body, 'รหัสยืนยันไม่ถูกต้อง') };
}
