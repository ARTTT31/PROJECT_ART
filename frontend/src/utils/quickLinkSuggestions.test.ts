import { describe, it, expect } from 'vitest';

import type { MainMenuItemConfig } from './mainMenu';
import {
  PAGE_VISITS_KEY,
  SUGGESTION_DISMISSED_KEY,
  dismissQuickLinkSuggestion,
  findQuickLinkSuggestion,
  normalizePath,
  readPageVisits,
  recordPageVisit,
} from './quickLinkSuggestions';

function makeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function menuItem(overrides: Partial<MainMenuItemConfig> = {}): MainMenuItemConfig {
  return {
    id: 'camera',
    name: 'กล้องวงจรปิด',
    href: '/camera',
    icon: 'camera',
    enabled: true,
    ...overrides,
  };
}

describe('normalizePath', () => {
  it('drops query, hash and trailing slashes', () => {
    expect(normalizePath('/camera/gate-1?view=grid#top')).toBe('/camera/gate-1');
    expect(normalizePath('/audit/')).toBe('/audit');
  });

  it('ignores the root and auth pages', () => {
    expect(normalizePath('/')).toBeNull();
    expect(normalizePath('/login')).toBeNull();
    expect(normalizePath('/login-success')).toBeNull();
    expect(normalizePath('/reset-password/abc')).toBeNull();
  });
});

describe('recordPageVisit', () => {
  it('counts repeated visits and persists them', () => {
    const store = makeStore();
    recordPageVisit('/camera/gate-1', store);
    const visits = recordPageVisit('/camera/gate-1', store);
    expect(visits['/camera/gate-1'].count).toBe(2);
    expect(readPageVisits(store)['/camera/gate-1'].count).toBe(2);
  });

  it('does not record a page that is not worth suggesting', () => {
    const store = makeStore();
    expect(recordPageVisit('/login', store)).toEqual({});
    expect(store.data.has(PAGE_VISITS_KEY)).toBe(false);
  });

  it('reads a corrupted store as empty', () => {
    expect(readPageVisits(makeStore({ [PAGE_VISITS_KEY]: 'not json' }))).toEqual({});
    expect(readPageVisits(makeStore({ [PAGE_VISITS_KEY]: '[]' }))).toEqual({});
  });
});

describe('findQuickLinkSuggestion', () => {
  const base = { links: [], mainMenu: [menuItem()] };

  it('stays quiet below the threshold', () => {
    const visits = { '/camera/gate-1': { count: 2, lastAt: 1 } };
    expect(findQuickLinkSuggestion({ ...base, visits, store: makeStore() })).toBeNull();
  });

  it('offers the page once it reaches the threshold', () => {
    const visits = { '/camera/gate-1': { count: 3, lastAt: 1 } };
    expect(findQuickLinkSuggestion({ ...base, visits, store: makeStore() })).toEqual({
      path: '/camera/gate-1',
      label: 'gate 1',
      icon: 'camera',
      count: 3,
    });
  });

  it('never suggests a page the enabled menu already offers', () => {
    const visits = { '/camera': { count: 9, lastAt: 1 } };
    expect(findQuickLinkSuggestion({ ...base, visits, store: makeStore() })).toBeNull();
  });

  it('never suggests a page that is in the menu, whatever the saved flag says', () => {
    // The menu is ordering-only now: the admin page switches decide visibility,
    // so a stale enabled flag must not turn a menu page into a suggestion.
    const visits = { '/camera': { count: 4, lastAt: 1 } };
    expect(
      findQuickLinkSuggestion({
        links: [],
        mainMenu: [menuItem({ enabled: false })],
        visits,
        store: makeStore(),
      }),
    ).toBeNull();
  });

  it('skips a page that is already a quick link', () => {
    const visits = { '/audit': { count: 5, lastAt: 1 } };
    const links = [{ id: 'a', label: 'บันทึกกิจกรรม', url: '/audit', icon: 'shield' as const }];
    expect(findQuickLinkSuggestion({ links, mainMenu: [], visits, store: makeStore() })).toBeNull();
  });

  it('respects a dismissal stored in this browser', () => {
    const store = makeStore({ [SUGGESTION_DISMISSED_KEY]: '["/audit"]' });
    const visits = { '/audit': { count: 5, lastAt: 1 } };
    expect(findQuickLinkSuggestion({ links: [], mainMenu: [], visits, store })).toBeNull();
  });

  it('dismissals accumulate without duplicates', () => {
    const store = makeStore();
    dismissQuickLinkSuggestion('/audit', store);
    dismissQuickLinkSuggestion('/audit', store);
    expect(JSON.parse(store.data.get(SUGGESTION_DISMISSED_KEY) ?? '[]')).toEqual(['/audit']);
  });

  it('prefers the most visited page, then the most recent', () => {
    const store = makeStore();
    const visits = {
      '/audit': { count: 3, lastAt: 10 },
      '/camera/gate-1': { count: 7, lastAt: 5 },
    };
    expect(
      findQuickLinkSuggestion({ links: [], mainMenu: [], visits, store })?.path,
    ).toBe('/camera/gate-1');

    const tie = {
      '/audit': { count: 3, lastAt: 10 },
      '/camera/gate-1': { count: 3, lastAt: 20 },
    };
    expect(findQuickLinkSuggestion({ links: [], mainMenu: [], visits: tie, store })?.path).toBe(
      '/camera/gate-1',
    );
  });

  it('names a known page from the product vocabulary', () => {
    const visits = { '/audit': { count: 3, lastAt: 1 } };
    const suggestion = findQuickLinkSuggestion({ links: [], mainMenu: [], visits, store: makeStore() });
    expect(suggestion?.label).toBe('บันทึกกิจกรรม');
    expect(suggestion?.icon).toBe('shield');
  });
});
