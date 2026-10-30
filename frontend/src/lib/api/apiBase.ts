/**
 * Browser API origin.
 *
 * The production deployment proxies `/api/*` through the Next.js rewrite, so
 * relative URLs keep the session cookies first-party. Calling the Render origin
 * directly makes them third-party cookies (`SameSite=None`), which Safari and
 * stricter browser privacy modes block. `NEXT_PUBLIC_USE_SAME_ORIGIN_API=false`
 * is the escape hatch for a deliberate direct-API deployment.
 *
 * Server components (`/branding-icon`) still need an absolute origin; use
 * `getServerApiBaseUrl()` there so the internal Render URL never depends on the
 * browser being present.
 */
const trimTrailingSlash = (value: string | undefined) => (value || '').replace(/\/$/, '');

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return trimTrailingSlash(process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL);
  }

  if (process.env.NEXT_PUBLIC_USE_SAME_ORIGIN_API !== 'false') {
    return '';
  }

  return trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL);
}

export function getServerApiBaseUrl(): string {
  return trimTrailingSlash(
    process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8080',
  );
}
