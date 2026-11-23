import { renderToString } from 'react-dom/server';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGE_SWITCHES, useEnabledPages, type PageSwitch } from './useEnabledPages';

const STORAGE_KEY = 'artEnabledPagesV1';

/** Camera switched off by the admin and cached by this browser. */
const STORED: PageSwitch[] = DEFAULT_PAGE_SWITCHES.map((page) =>
  page.id === 'camera' ? { ...page, enabled: false } : page,
);

const signature = (pages: PageSwitch[]) =>
  pages.map((page) => `${page.id}:${page.enabled}`).join(',');

function Probe() {
  const pages = useEnabledPages();
  return <span>{signature(pages)}</span>;
}

describe('useEnabledPages', () => {
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(STORED));
    // The hook refreshes from the API on mount; a failing answer keeps it on the
    // cached copy, which is what these cases care about.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('renders the workspace defaults on the server, not the browser copy', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const html = renderToString(<Probe />);

    // The server cannot reach localStorage, so the HTML the browser gets is the
    // default list. The client's first render must say the same thing or React
    // aborts the tree with #418 — the sidebar's item count and icons were the
    // visible difference between the two.
    expect(html).toContain(signature(DEFAULT_PAGE_SWITCHES));
    expect(html).not.toContain('camera:false');
    expect(getItem).not.toHaveBeenCalledWith(STORAGE_KEY);
    getItem.mockRestore();
  });

  it('applies the cached switches after mount', async () => {
    const { result } = renderHook(() => useEnabledPages());

    await waitFor(() => {
      expect(result.current.find((page) => page.id === 'camera')?.enabled).toBe(false);
    });
  });
});
