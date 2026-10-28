/**
 * Camera URL hygiene (T16).
 *
 * - Credentials must never be STORED inside camera URLs: anything typed as
 *   `https://user:pass@host/stream` is stripped before it reaches
 *   localStorage or the users table (the backend copies this string verbatim).
 * - The `iframe` stream type is removed (blocked by the CSP frame-src it
 *   would require); legacy saved configs of that type fall back to the
 *   simulated viewer instead of rendering a dead frame.
 */

export function stripCameraCredentials(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return url;
    parsed.username = '';
    parsed.password = '';
    const cleaned = parsed.toString();
    // WHATWG URL keeps no empty userinfo, so the result is credential-free.
    if (!cleaned.includes('@')) return cleaned;
  } catch {
    // Fall through to the regex path for non-WhatWG-parseable schemes.
  }
  // Drop `user:pass@` (also `user@`) right after the scheme separator.
  return url.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/, '$1');
}

export type CameraStreamType = 'snapshot' | 'mjpeg' | 'simulated';

/**
 * Migrate a legacy saved config: drop the removed iframe type and strip any
 * credentials that previous editors stored inside URLs.
 */
export function sanitizeCameraStreams<T extends { streamType: string; url?: string | null }>(
  streams: T[],
): T[] {
  return streams.map((s) => {
    const out = { ...s };
    if (out.streamType === 'iframe') {
      out.streamType = 'simulated';
      out.url = null;
    }
    if (typeof out.url === 'string' && out.url) {
      out.url = stripCameraCredentials(out.url);
    }
    return out;
  });
}
