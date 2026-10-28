import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearServiceWorkerCaches, isApiPathname } from './swCacheRules';

describe('isApiPathname', () => {
  it('treats everything under /api/ as network-only', () => {
    expect(isApiPathname(new URL('https://art.app/api/v1/profile/me'))).toBe(true);
    expect(isApiPathname(new URL('https://art.app/api/v1/auth/logout'))).toBe(true);
  });

  it('leaves pages and static assets cacheable', () => {
    expect(isApiPathname(new URL('https://art.app/login'))).toBe(false);
    expect(isApiPathname(new URL('https://art.app/_next/static/chunk.js'))).toBe(false);
  });
});

describe('clearServiceWorkerCaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes every cache region on logout', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => ['precache-v1', 'runtime-v2']),
      delete: vi.fn(async (name: string) => {
        deleted.push(name);
        return true;
      }),
    });

    expect(await clearServiceWorkerCaches()).toBe(2);
    expect(deleted).toEqual(['precache-v1', 'runtime-v2']);
  });

  it('is a no-op where Cache Storage is unavailable', async () => {
    expect(await clearServiceWorkerCaches()).toBe(0);
  });
});
