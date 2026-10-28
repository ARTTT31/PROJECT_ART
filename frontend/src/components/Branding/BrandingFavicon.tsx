'use client';

import { useEffect } from 'react';
import { useBranding } from '@/context/BrandingContext';

/**
 * Cheap deterministic version tag so a freshly uploaded logo is not hidden by
 * the icon route's own cache.
 */
function iconVersion(logo: string): string {
  let hash = 0;
  for (let index = 0; index < logo.length; index += 1) {
    hash = (hash * 31 + logo.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Next renders the icon link tags once per page load, so a logo uploaded a
 * second ago would keep showing the default mark until a refresh. This keeps
 * the tab icon and the iOS home-screen icon in sync with the branding context.
 */
export function BrandingFavicon() {
  const { brandLogoUrl } = useBranding();

  useEffect(() => {
    if (!brandLogoUrl) return;

    // A personal logo is stored as a data URL on the account, so it can be used
    // directly; the workspace logo goes through the icon route.
    const href = brandLogoUrl.startsWith('data:')
      ? brandLogoUrl
      : `/branding-icon?size=192&v=${iconVersion(brandLogoUrl)}`;
    // `rel="shortcut icon"` is one token with a space, so it needs its own
    // selector; a plain `rel="shortcut"` link would be a different (invalid) rel.
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ];

    selectors.forEach((selector) => {
      document.head.querySelectorAll<HTMLLinkElement>(selector).forEach((link) => {
        link.href = href;
      });
    });
  }, [brandLogoUrl]);

  return null;
}

export default BrandingFavicon;
