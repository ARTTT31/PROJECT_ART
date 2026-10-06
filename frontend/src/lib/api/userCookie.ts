/**
 * Read the readable `user` cookie the backend writes on login / refresh / OAuth.
 *
 * The payload is percent-encoded JSON (`encode_user_cookie` on the Python
 * side). A raw `json.dumps` value would be quoted and octal-escaped by the
 * cookie serialiser (commas become `\054` and the whole value is wrapped in
 * double quotes), which `document.cookie` readers cannot parse — that made the
 * old fast-path fail on every login. This mirrors the encoding so both sides
 * agree on the wire format.
 *
 * Returns the decoded JSON value, or `null` when the cookie is absent or
 * unparsable (callers treat that as "no fast-path data" and fall back).
 */
export function readUserCookie(): unknown | null {
  if (typeof document === 'undefined') return null

  const row = document.cookie.split('; ').find((c) => c.startsWith('user='))
  if (!row) return null

  // Slice after the FIRST '=' only: percent-encoded values never contain a raw
  // '=', but a stale legacy value might.
  const raw = row.slice('user='.length)
  if (!raw) return null

  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }
}
