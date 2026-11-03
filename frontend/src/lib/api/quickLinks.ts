'use client';

import { fetchWithAuth } from './fetchWithAuth';
import { serializeQuickLinks, type QuickLink } from '@/utils/quickLinks';

/**
 * Persist the whole quick-link list.
 *
 * The API takes the entire array as one JSON string, so callers pass the list
 * they want stored and get back the exact text to put into the session (`null`
 * when the request failed). Used by the sidebar's "save this page" suggestion,
 * which must not import the profile page just to save one link.
 */
export async function persistQuickLinks(links: QuickLink[]): Promise<string | null> {
  const raw = serializeQuickLinks(links);
  try {
    const response = await fetchWithAuth('/api/v1/profile/quick-links', {
      method: 'POST',
      body: JSON.stringify({ quick_links: raw }),
    });
    return response.ok ? raw : null;
  } catch {
    return null;
  }
}
