import { describe, expect, it } from 'vitest';
import { readOilSnapshot, readWeatherSnapshot, readWorkspaceSnapshot } from './widgetSnapshot';

function store(entries: Record<string, string>) {
  return { getItem: (key: string) => entries[key] ?? null };
}

describe('readWeatherSnapshot', () => {
  it('reads the current cache key and normalises missing numbers to null', () => {
    const snapshot = readWeatherSnapshot(
      store({
        artWeatherCacheV7: JSON.stringify({
          cityName: 'กรุงเทพฯ',
          weather: { rainProb: 75 },
          airQuality: { pm25: 85 },
        }),
      }),
    );

    expect(snapshot).toEqual({ cityName: 'กรุงเทพฯ', pm25: 85, rainProb: 75 });
  });

  it('falls back to an older cache version and the default city name', () => {
    const snapshot = readWeatherSnapshot(
      store({ artWeatherCacheV5: JSON.stringify({ airQuality: { pm25: 40 } }) }),
    );

    expect(snapshot).toEqual({ cityName: 'พื้นที่ของคุณ', pm25: 40, rainProb: null });
  });

  it('ignores malformed JSON instead of throwing', () => {
    expect(readWeatherSnapshot(store({ artWeatherCacheV7: '{nope' }))).toBeNull();
  });
});

describe('readOilSnapshot', () => {
  it('reports only prices that moved, using the previous-price map', () => {
    const snapshot = readOilSnapshot(
      store({
        artOilPriceCacheV1: JSON.stringify({
          data: {
            update_date: '2026-10-31',
            prices: [
              { key: 'diesel', name: 'ดีเซล', price: 33.94 },
              { key: 'gasohol_95', name: 'แก๊สโซฮอล์ 95', price: 37.55 },
            ],
          },
        }),
        artOilPricePrevV1: JSON.stringify({ diesel: 32.94, gasohol_95: 37.55 }),
      }),
    );

    expect(snapshot).toEqual({
      updateDate: '2026-10-31',
      changes: [{ name: 'ดีเซล', diff: 1 }],
    });
  });

  it('accepts the snake_case price list and treats an absent baseline as no change', () => {
    const snapshot = readOilSnapshot(
      store({
        artOilPriceCacheV1: JSON.stringify({
          data: { oil_prices: [{ key: 'e20', name: 'E20', price: 30 }] },
        }),
      }),
    );

    expect(snapshot).toEqual({ updateDate: '', changes: [] });
  });

  it('returns null when there is no cache at all', () => {
    expect(readOilSnapshot(store({}))).toBeNull();
  });
});

describe('readWorkspaceSnapshot', () => {
  it('reads both halves in one call', () => {
    const snapshot = readWorkspaceSnapshot(
      store({
        artWeatherCacheV7: JSON.stringify({ airQuality: { pm25: 85 } }),
        artOilPriceCacheV1: JSON.stringify({ data: { prices: [] } }),
      }),
    );

    expect(snapshot.weather?.pm25).toBe(85);
    expect(snapshot.oil?.changes).toEqual([]);
  });
});
