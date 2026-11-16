import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('@/lib/api/fetchWithAuth', () => ({ fetchWithAuth: api.fetchWithAuth }));

import { clearSharedFetchCache, fetchShared } from './sharedFetch';

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('sharedFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSharedFetchCache();
  });

  it('joins concurrent identical requests instead of firing two', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    api.fetchWithAuth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = fetchShared<{ v: number }>('/api/shared', 60_000);
    const second = fetchShared<{ v: number }>('/api/shared', 60_000);
    resolveRequest(response({ v: 1 }));

    expect(await first).toEqual({ ok: true, status: 200, data: { v: 1 } });
    expect(await second).toEqual({ ok: true, status: 200, data: { v: 1 } });
    expect(api.fetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it('serves the cached copy inside the TTL and refetches once it lapses', async () => {
    api.fetchWithAuth.mockResolvedValue(response({ v: 1 }));

    await fetchShared('/api/shared', 60_000);
    await fetchShared('/api/shared', 60_000);
    expect(api.fetchWithAuth).toHaveBeenCalledTimes(1);

    // Negative TTL: the entry written above is already stale.
    await fetchShared('/api/shared', -1);
    expect(api.fetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed response, so a retry really retries', async () => {
    api.fetchWithAuth.mockResolvedValue(response({}, 502));

    expect(await fetchShared('/api/shared', 60_000)).toEqual({
      ok: false,
      status: 502,
      data: null,
    });

    api.fetchWithAuth.mockResolvedValue(response({ v: 2 }));
    expect(await fetchShared('/api/shared', 60_000)).toEqual({
      ok: true,
      status: 200,
      data: { v: 2 },
    });
    expect(api.fetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it('reports a network failure as status 0', async () => {
    api.fetchWithAuth.mockRejectedValue(new Error('offline'));

    expect(await fetchShared('/api/shared', 60_000)).toEqual({
      ok: false,
      status: 0,
      data: null,
    });
  });
});
