/**
 * Read the readable `user` cookie the backend writes on login / refresh / OAuth.
 *
 * The payload is percent-encoded JSON (`encode_user_cookie` on the Python
 * side) followed by `.<hmac-sha256 hex>`. A raw `json.dumps` value would be
 * quoted and octal-escaped by the cookie serialiser (commas become `\054` and
 * the whole value is wrapped in double quotes), which `document.cookie`
 * readers cannot parse — that made the old fast-path fail on every login. This
 * mirrors the encoding so both sides agree on the wire format.
 *
 * The signature is stripped, not checked: verifying it needs `SECRET_KEY`,
 * which must never reach the browser. Dropping it here keeps the parsing in
 * one place; the server is what rejects a tampered value.
 *
 * Returns the decoded JSON value, or `null` when the cookie is absent or
 * unparsable (callers treat that as "no fast-path data" and fall back).
 */
export function readUserCookie(): unknown | null {
  if (typeof document === 'undefined') return null;

  const row = document.cookie.split('; ').find((c) => c.startsWith('user='));
  if (!row) return null;

  // Slice after the FIRST '=' only: percent-encoded values never contain a raw
  // '=', but a stale legacy value might.
  const raw = row.slice('user='.length);
  if (!raw) return null;

  // Only a trailing 64-hex signature is removed. Stripping at the last dot
  // unconditionally would truncate a legacy unsigned payload whose JSON itself
  // contains a dot (an email address, for instance).
  const signed = /\.([0-9a-f]{64})$/.exec(raw);
  const payload = signed ? raw.slice(0, signed.index) : raw;

  try {
    return JSON.parse(decodeURIComponent(payload));
  } catch {
    return null;
  }
}
