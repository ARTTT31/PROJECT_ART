import { describe, it, expect } from 'vitest';

import { ALL_PAGES, DEFAULT_PAGES, canAccessPage, parseAccessiblePages } from './accessiblePages';

/**
 * `accessible_pages` arrives as JSON written by the admin panel, so the parser
 * has to survive junk — and, more importantly, must never turn a missing or
 * unreadable value into "everything". NULL is the historic default of dashboard
 * + profile, and that is the rule the backend applies too.
 */

describe('parseAccessiblePages', () => {
  it('falls back to the default for a missing value', () => {
    expect(parseAccessiblePages(null)).toEqual([...DEFAULT_PAGES]);
    expect(parseAccessiblePages(undefined)).toEqual([...DEFAULT_PAGES]);
    expect(parseAccessiblePages('')).toEqual([...DEFAULT_PAGES]);
  });

  it('falls back to the default for malformed or non-array JSON', () => {
    expect(parseAccessiblePages('[broken')).toEqual([...DEFAULT_PAGES]);
    expect(parseAccessiblePages('{"dashboard": true}')).toEqual([...DEFAULT_PAGES]);
    expect(parseAccessiblePages('"dashboard"')).toEqual([...DEFAULT_PAGES]);
  });

  it('reads the stored list and ignores non-string entries', () => {
    expect(parseAccessiblePages('["dashboard","camera",7,null]')).toEqual(['dashboard', 'camera']);
  });

  it('accepts an already parsed array', () => {
    expect(parseAccessiblePages(['camera'])).toEqual(['camera']);
  });

  it('honours an empty list instead of granting the default', () => {
    expect(parseAccessiblePages('[]')).toEqual([]);
  });
});

describe('canAccessPage', () => {
  it('allows the pages in the list only', () => {
    const user = { role: 'user', accessible_pages: '["dashboard","profile"]' };

    expect(canAccessPage(user, 'dashboard')).toBe(true);
    expect(canAccessPage(user, 'camera')).toBe(false);
  });

  it('treats a missing list as dashboard + profile', () => {
    const user = { role: 'user', accessible_pages: null };

    expect(canAccessPage(user, 'dashboard')).toBe(true);
    expect(canAccessPage(user, 'profile')).toBe(true);
    expect(canAccessPage(user, 'camera')).toBe(false);
  });

  it('never gates an admin, whatever the list says', () => {
    const admin = { role: 'admin', accessible_pages: '["dashboard"]' };

    for (const page of ALL_PAGES) {
      expect(canAccessPage(admin, page)).toBe(true);
    }
  });

  it('refuses unknown pages and a signed-out visitor', () => {
    const user = { role: 'user', accessible_pages: '["dashboard","profile","camera"]' };

    expect(canAccessPage(user, 'admin')).toBe(false);
    expect(canAccessPage(null, 'dashboard')).toBe(false);
  });
});
