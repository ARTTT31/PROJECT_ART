/**
 * The notification bell and the widgets read the same cached payloads. This is
 * the single place that resolves which cache version is current and how to
 * parse it defensively, so a version bump is a one-line change instead of two
 * parsers drifting apart (open finding U14).
 */

export interface WeatherSnapshot {
  cityName: string;
  pm25: number | null;
  rainProb: number | null;
}

export interface OilPriceChange {
  name: string;
  diff: number;
}

export interface OilSnapshot {
  updateDate: string;
  changes: OilPriceChange[];
}

export interface WorkspaceSnapshot {
  weather: WeatherSnapshot | null;
  oil: OilSnapshot | null;
}

type StorageLike = Pick<Storage, 'getItem'>;

// Newest first: an older key is only read when the current one is absent, so a
// deployment mid-upgrade still shows the alert instead of dropping it.
const WEATHER_CACHE_KEYS = ['artWeatherCacheV7', 'artWeatherCacheV6', 'artWeatherCacheV5'];
const OIL_CACHE_KEY = 'artOilPriceCacheV1';
const OIL_PREV_KEY = 'artOilPricePrevV1';

function browserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readJson(store: StorageLike | null, key: string): unknown {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readWeatherSnapshot(
  store: StorageLike | null = browserStorage(),
): WeatherSnapshot | null {
  for (const key of WEATHER_CACHE_KEYS) {
    const cache = asRecord(readJson(store, key));
    if (!cache) continue;
    const airQuality = asRecord(cache.airQuality);
    const weather = asRecord(cache.weather);
    const cityName =
      typeof cache.cityName === 'string' && cache.cityName ? cache.cityName : 'พื้นที่ของคุณ';
    return {
      cityName,
      pm25: asNumber(airQuality?.pm25),
      rainProb: asNumber(weather?.rainProb),
    };
  }
  return null;
}

export function readOilSnapshot(store: StorageLike | null = browserStorage()): OilSnapshot | null {
  const cache = asRecord(readJson(store, OIL_CACHE_KEY));
  const data = asRecord(cache?.data);
  if (!data) return null;

  const rawPrices = Array.isArray(data.prices)
    ? data.prices
    : Array.isArray(data.oil_prices)
      ? data.oil_prices
      : [];
  const previous = asRecord(readJson(store, OIL_PREV_KEY)) ?? {};

  const changes: OilPriceChange[] = [];
  for (const entry of rawPrices) {
    const price = asRecord(entry);
    if (!price) continue;
    const key = typeof price.key === 'string' ? price.key : null;
    const name = typeof price.name === 'string' ? price.name : null;
    const value = asNumber(price.price);
    const oldValue = key ? asNumber(previous[key]) : null;
    if (!name || value === null || oldValue === null) continue;

    const diff = Math.round((value - oldValue) * 100) / 100;
    if (diff !== 0) changes.push({ name, diff });
  }

  return {
    updateDate: typeof data.update_date === 'string' ? data.update_date : '',
    changes,
  };
}

export function readWorkspaceSnapshot(
  store: StorageLike | null = browserStorage(),
): WorkspaceSnapshot {
  return { weather: readWeatherSnapshot(store), oil: readOilSnapshot(store) };
}
