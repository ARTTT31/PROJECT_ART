import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readHistory,
  appendHistory,
  clearHistory,
  syncHistoryToServer,
  fetchServerHistory,
  markAllReadOnServer,
  clearHistoryOnServer,
} from './history';

describe('notification history', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads empty list when nothing is stored', () => {
    expect(readHistory()).toEqual([]);
  });

  it('appends notifications and sorts them newest first without duplicates', () => {
    const older = {
      id: 'n-1',
      type: 'system' as const,
      level: 'info' as const,
      title: 'Older alert',
      body: 'Old message',
      at: new Date('2026-11-14T01:00:00Z'),
    };
    const newer = {
      id: 'n-2',
      type: 'weather' as const,
      level: 'warning' as const,
      title: 'Newer alert',
      body: 'Rain coming',
      at: new Date('2026-11-14T02:00:00Z'),
    };

    appendHistory([older]);
    const merged = appendHistory([newer, older]);

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('n-2');
    expect(merged[1].id).toBe('n-1');
    expect(readHistory()).toEqual(merged);
  });

  it('clears stored history', () => {
    appendHistory([
      {
        id: 'n-1',
        type: 'system',
        level: 'info',
        title: 'Alert',
        body: 'Msg',
        at: new Date(),
      },
    ]);
    expect(readHistory()).toHaveLength(1);
    clearHistory();
    expect(readHistory()).toEqual([]);
  });

  it('syncs history items to server with ISO string', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], unread: 0 }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const atDate = new Date('2026-11-14T06:30:00Z');
    await syncHistoryToServer([
      {
        id: 'sync-1',
        type: 'oilprice',
        level: 'info',
        title: 'Oil',
        body: 'Price',
        at: atDate,
      },
    ]);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/notifications/sync',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          items: [
            {
              client_id: 'sync-1',
              type: 'oilprice',
              level: 'info',
              title: 'Oil',
              body: 'Price',
              at: atDate.toISOString(),
            },
          ],
        }),
      }),
    );
  });

  it('fetches server history and returns items list', async () => {
    const mockItems = [
      {
        id: 1,
        client_id: 'srv-1',
        type: 'system',
        level: 'info',
        title: 'Title',
        body: 'Body',
        at: '2026-11-14T06:30:00+00:00',
        read: false,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: mockItems, unread: 1 }),
      }),
    );

    const result = await fetchServerHistory();
    expect(result).toEqual(mockItems);
  });

  it('calls markAllReadOnServer and clearHistoryOnServer', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrf_token: 'dummy-token' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await markAllReadOnServer();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/notifications/read-all',
      expect.objectContaining({ method: 'POST' }),
    );

    await clearHistoryOnServer();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/notifications',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
