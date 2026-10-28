import { NextResponse } from 'next/server';

/**
 * The tab icon and the PWA manifest must follow the workspace logo an admin
 * uploaded, but a manifest cannot point at a `data:` URL and the logo lives in
 * the database. This route resolves the two cases to a real PNG: the stored
 * logo through the API, or the bundled app mark when no logo is set.
 */
const API_BASE = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');

const MIN_SIZE = 32;
const MAX_SIZE = 512;
const DEFAULT_SIZE = 192;

export const dynamic = 'force-dynamic';

function parseSize(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SIZE;
  return Math.min(Math.max(Math.round(parsed), MIN_SIZE), MAX_SIZE);
}

export async function GET(request: Request) {
  const size = parseSize(new URL(request.url).searchParams.get('size'));

  let hasLogo = false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/system/branding`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { brand_logo_url?: unknown };
      hasLogo = typeof data.brand_logo_url === 'string' && data.brand_logo_url.length > 0;
    }
  } catch {
    // Backend unreachable: fall back to the bundled icon instead of a broken tab.
  }

  // Both targets are same-origin: the API path is proxied by the Next rewrite,
  // which keeps the icon usable as a manifest icon as well.
  const target = hasLogo
    ? `/api/v1/system/branding/logo.png?size=${size}`
    : size >= MAX_SIZE
      ? '/app-icon-512.png'
      : '/app-icon-192.png';

  return NextResponse.redirect(new URL(target, request.url), {
    status: 307,
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
  });
}
