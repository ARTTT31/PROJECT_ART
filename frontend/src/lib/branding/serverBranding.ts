import { cache } from 'react';

/**
 * Branding as the server sees it (layout metadata + web app manifest).
 *
 * Both need the workspace name before any client code runs, and neither can
 * read the account's personal override: the manifest fetch is not authenticated
 * in every browser, and the metadata is rendered for signed-out visitors too.
 * The workspace-wide value is therefore the honest answer for "what is this app
 * called" — an account rename still applies to everything inside the app.
 */
export interface ServerBranding {
  company_name: string;
  company_tagline: string;
  brand_logo_url: string;
}

export const DEFAULT_WORKSPACE_NAME = 'Workspace';
export const DEFAULT_WORKSPACE_TAGLINE = 'จัดการวันทำงานของคุณให้ง่ายขึ้น';

const API_BASE = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');

/** An installed app must not show a URL-length name under the icon. */
const SHORT_NAME_MAX = 12;

export function shortAppName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= SHORT_NAME_MAX) return trimmed;
  return `${trimmed.slice(0, SHORT_NAME_MAX - 1).trimEnd()}…`;
}

/**
 * Deterministic tag for icon URLs. Android re-reads the manifest on launch and
 * only refreshes an installed icon when its URL changes, so a new name or logo
 * has to produce a new URL.
 */
export function brandingVersion(...values: string[]): string {
  let hash = 0;
  const source = values.join('|');
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export async function fetchServerBranding(): Promise<ServerBranding> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/system/branding`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`branding ${res.status}`);
    const data = (await res.json()) as Partial<ServerBranding>;
    return {
      company_name: (data.company_name || '').trim() || DEFAULT_WORKSPACE_NAME,
      company_tagline:
        (data.company_tagline || '').trim() || DEFAULT_WORKSPACE_TAGLINE,
      brand_logo_url: data.brand_logo_url || '',
    };
  } catch {
    // Backend unreachable during a build or an outage: a neutral name is better
    // than failing the whole page or manifest.
    return {
      company_name: DEFAULT_WORKSPACE_NAME,
      company_tagline: DEFAULT_WORKSPACE_TAGLINE,
      brand_logo_url: '',
    };
  }
}

/**
 * One branding read per request. The root layout seeds `BrandingProvider` with
 * it and `generateMetadata` names the page with it, so asking the API twice for
 * the same answer only added a round trip.
 */
export const getServerBranding = cache(fetchServerBranding);
