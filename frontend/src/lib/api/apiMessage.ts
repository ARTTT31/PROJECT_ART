/**
 * Reads a user-facing message out of an API response body.
 *
 * FastAPI sends `{detail: "..."}` for handled errors and `{detail: [{msg, loc}]}`
 * for validation problems (pydantic), so both shapes are unpacked here — one
 * helper shared by every profile card instead of each handler guessing.
 */
export function apiMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return fallback;
}
