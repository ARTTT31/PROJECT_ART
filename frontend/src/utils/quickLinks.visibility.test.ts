import { describe, it, expect } from 'vitest';

import { isQuickLinkVisible, quickLinkPageId } from './quickLinks';

/**
 * A quick link can point inside the app, so it has to obey the same page gate
 * as the main menu. This is the one property a browser bookmark cannot have:
 * the link knows whether this account is allowed to open its destination.
 */

describe('quickLinkPageId', () => {
  it('extracts the first path segment of an in-app URL', () => {
    expect(quickLinkPageId('/dashboard')).toBe('dashboard');
    expect(quickLinkPageId('/camera?x=1')).toBe('camera');
    expect(quickLinkPageId('/camera#top')).toBe('camera');
  });

  it('is null for the root, external URLs and protocol-relative URLs', () => {
    expect(quickLinkPageId('/')).toBeNull();
    expect(quickLinkPageId('https://example.com/dashboard')).toBeNull();
    expect(quickLinkPageId('//evil.example/dashboard')).toBeNull();
  });
});

describe('isQuickLinkVisible', () => {
  const limited = { role: 'user', accessible_pages: '["dashboard","profile"]' };
  const admin = { role: 'admin', accessible_pages: null };

  it('keeps external links and the root for every account', () => {
    expect(isQuickLinkVisible({ url: 'https://mail.google.com' }, limited)).toBe(true);
    expect(isQuickLinkVisible({ url: '/' }, limited)).toBe(true);
  });

  it('hides an in-app page the account cannot open', () => {
    expect(isQuickLinkVisible({ url: '/camera' }, limited)).toBe(false);
    expect(isQuickLinkVisible({ url: '/camera/gate-1?view=grid' }, limited)).toBe(false);
  });

  it('keeps an in-app page the account may open', () => {
    expect(isQuickLinkVisible({ url: '/dashboard' }, limited)).toBe(true);
    expect(isQuickLinkVisible({ url: '/profile#quick-links' }, limited)).toBe(true);
  });

  it('gates admin-only routes on the role', () => {
    expect(isQuickLinkVisible({ url: '/admin' }, limited)).toBe(false);
    expect(isQuickLinkVisible({ url: '/audit' }, limited)).toBe(false);
    expect(isQuickLinkVisible({ url: '/admin' }, admin)).toBe(true);
  });

  it('does not hide deep routes this product knows nothing about', () => {
    expect(isQuickLinkVisible({ url: '/reports/q4' }, limited)).toBe(true);
  });

  it('hides an internal page when nobody is signed in', () => {
    expect(isQuickLinkVisible({ url: '/camera' }, null)).toBe(false);
  });
});
