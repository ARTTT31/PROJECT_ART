import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOfflineData,
  clearPending,
  isOffline,
  readCached,
  readPending,
  writeCached,
  writePending,
} from './localStore';

function signIn(id: string) {
  document.cookie = `user=${encodeURIComponent(JSON.stringify({ id }))}; path=/`;
}

function signOut() {
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

describe('offline localStore', () => {
  beforeEach(() => {
    localStorage.clear();
    signOut();
  });

  it('round-trips a cached resource', () => {
    signIn('user-a');
    writeCached('profile/quick-notes', { notes: [{ id: 'n1', text: 'งาน', done: false }] });

    const cached = readCached<{ notes: Array<{ id: string }> }>('profile/quick-notes');
    expect(cached?.data.notes).toHaveLength(1);
    expect(cached?.savedAt).toBeTypeOf('number');
  });

  it('keeps each account’s mirror separate', () => {
    signIn('user-a');
    writeCached('profile/finance', { entries: [{ id: 'a' }], budget: null });

    signIn('user-b');
    expect(readCached('profile/finance')).toBeNull();

    signIn('user-a');
    expect(readCached<{ entries: unknown[] }>('profile/finance')?.data.entries).toHaveLength(1);
  });

  it('keeps a pending write until the save succeeds', () => {
    signIn('user-a');
    writePending('profile/finance', { entries: [{ id: 'a' }], deletedIds: [] });

    expect(readPending<{ entries: unknown[] }>('profile/finance')?.data.entries).toHaveLength(1);

    clearPending('profile/finance');
    expect(readPending('profile/finance')).toBeNull();
  });

  it('ignores corrupt stored JSON instead of throwing', () => {
    signIn('user-a');
    localStorage.setItem(
      'artOffline:v1:user-a:cache:profile/finance',
      '<<<not json',
    );

    expect(readCached('profile/finance')).toBeNull();
  });

  it('wipes every account’s mirror on logout', () => {
    signIn('user-a');
    writeCached('profile/finance', { entries: [], budget: null });
    writePending('profile/finance', { entries: [] });
    signIn('user-b');
    writeCached('profile/quick-notes', { notes: [] });

    clearOfflineData();

    expect(Object.keys(localStorage).filter((key) => key.startsWith('artOffline:'))).toEqual([]);
  });

  it('reports the browser connection state', () => {
    expect(isOffline()).toBe(false);

    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isOffline()).toBe(true);
    spy.mockRestore();
  });
});
