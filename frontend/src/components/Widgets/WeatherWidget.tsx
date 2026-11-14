'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Droplets,
  LocateFixed,
  MapPin,
  RefreshCw,
  Wind,
  ChevronDown,
  AlertCircle,
  Navigation,
  Clock,
} from 'lucide-react';
import WidgetSizeToggle from './WidgetSizeToggle';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { translateText } from '@/lib/i18n/translate';
import {
  CACHE_KEY,
  CACHE_TTL_MS,
  CITY_PRESETS,
  cityName,
  getPM25Meta,
  getWeatherMeta,
  LOCATION_KEY,
  safeJsonParse,
  type AirQualityData,
  type CityLocation,
  type CombinedWeatherCache,
  type HourlyForecastItem,
  type WeatherData,
} from './weatherModel';

// ── Reverse Geocoding Helper ─────────────────────────────────────────────────

async function resolveLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetchWithAuth(
      `/api/v1/weather/reverse-geocode?latitude=${lat}&longitude=${lon}&locality_language=th`,
    );
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || '';
      const city = data.city || data.principalSubdivision || '';
      if (locality && city) return `${locality}, ${city}`;
      if (city) return city;
      if (data.countryName) return data.countryName;
    }
  } catch {}
  return `${translateText('พิกัด', 'Coordinates')} ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function WeatherWidget({
  width = 1,
  onResize,
}: {
  width?: number;
  onResize?: (size: number) => void;
}) {
  const { tr, locale } = useI18n();
  const [selectedCity, setSelectedCity] = useState<CityLocation>(CITY_PRESETS[0]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // `fetchWeatherData` is a `useCallback([])` and never sees fresh state, so the
  // data actually on screen is mirrored here for the fallback decisions below.
  const dataRef = useRef<{ weather: WeatherData | null; airQuality: AirQualityData | null }>({
    weather: null,
    airQuality: null,
  });

  const displayTemp = useCallback(
    (celsius: number) => {
      return unit === 'C' ? celsius : Math.round((celsius * 9) / 5 + 32);
    },
    [unit],
  );

  // ── Fetch Weather & AQI from Open-Meteo ─────────────────────────────────────
  const fetchWeatherData = useCallback(async (city: CityLocation, isRefresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setStaleNotice(null);

    try {
      const weatherUrl = `/api/v1/weather/forecast?latitude=${city.lat}&longitude=${city.lon}&timezone=Asia%2FBangkok&forecast_days=2`;
      const aqiUrl = `/api/v1/weather/air-quality?latitude=${city.lat}&longitude=${city.lon}&timezone=Asia%2FBangkok`;

      // `fetchWithAuth` refreshes an expired access token and retries, so the
      // card recovers instead of showing the "cannot load" error. The widget's
      // own controller cannot cancel that retry, hence the aborted guard below.
      const [weatherRes, aqiRes] = await Promise.all([
        fetchWithAuth(weatherUrl, { signal: controller.signal }),
        fetchWithAuth(aqiUrl, { signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      // The two endpoints fail independently — the forecast call is the one
      // Open-Meteo throttles — so each half is optional. Throwing because one
      // of them 502'd used to discard the other half along with it.
      const weatherJson = weatherRes.ok ? await weatherRes.json().catch(() => null) : null;
      const aqiJson = aqiRes.ok ? await aqiRes.json().catch(() => null) : null;

      if (!weatherJson && !aqiJson) {
        throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้');
      }

      let mappedWeather: WeatherData | null = null;
      if (weatherJson?.current) {
        const dailyMax: number[] = weatherJson.daily?.temperature_2m_max || [];
        const dailyMin: number[] = weatherJson.daily?.temperature_2m_min || [];
        const dailyRain: number[] = weatherJson.daily?.precipitation_probability_max || [];

        // Hourly forecast extraction
        const hourlyTimes: string[] = weatherJson.hourly?.time || [];
        const hourlyTemps: number[] = weatherJson.hourly?.temperature_2m || [];
        const hourlyCodes: number[] = weatherJson.hourly?.weather_code || [];
        const hourlyRains: number[] = weatherJson.hourly?.precipitation_probability || [];

        const now = new Date();
        const currentHour = now.getHours();
        const todayIsoDate = now.toISOString().slice(0, 10);

        // Find matching current hour index
        let startIndex = hourlyTimes.findIndex((tStr) => {
          const d = new Date(tStr);
          return d.getHours() === currentHour && tStr.startsWith(todayIsoDate);
        });

        if (startIndex === -1) {
          startIndex = 0;
        }

        const hourlyList: HourlyForecastItem[] = [];
        const totalHoursToExtract = 8;

        for (
          let i = startIndex;
          i < Math.min(hourlyTimes.length, startIndex + totalHoursToExtract);
          i++
        ) {
          const d = new Date(hourlyTimes[i]);
          const hour = d.getHours();
          const isNow = i === startIndex;
          const formattedHour = `${String(hour).padStart(2, '0')}:00`;

          hourlyList.push({
            time: isNow ? translateText('ตอนนี้', 'Now') : formattedHour,
            rawTime: hourlyTimes[i],
            weatherCode: hourlyCodes[i] ?? 0,
            temp: Math.round(hourlyTemps[i] ?? 0),
            rainProb: hourlyRains[i] ?? 0,
            isCurrent: isNow,
          });
        }

        mappedWeather = {
          currentTemp: Math.round(weatherJson.current?.temperature_2m ?? 0),
          apparentTemp: Math.round(weatherJson.current?.apparent_temperature ?? 0),
          humidity: Math.round(weatherJson.current?.relative_humidity_2m ?? 0),
          windSpeed: Math.round(weatherJson.current?.wind_speed_10m ?? 0),
          weatherCode: weatherJson.current?.weather_code ?? 0,
          tempMax: Math.round(dailyMax[0] ?? 0),
          tempMin: Math.round(dailyMin[0] ?? 0),
          rainProb: Math.round(dailyRain[0] ?? 0),
          hourlyForecast: hourlyList,
        };
      }

      let mappedAqi: AirQualityData | null = null;
      if (aqiJson?.current) {
        mappedAqi = {
          pm25: Math.round((aqiJson.current.pm2_5 ?? 0) * 10) / 10,
          pm10: Math.round((aqiJson.current.pm10 ?? 0) * 10) / 10,
          usAqi: Math.round(aqiJson.current.us_aqi ?? 0),
        };
      }

      // Half a response is enough to keep rendering: the cached half stands in
      // for the part the provider refused this time round.
      const nextWeather = mappedWeather ?? dataRef.current.weather;
      const nextAirQuality = mappedAqi ?? dataRef.current.airQuality;

      if (!nextWeather || !nextAirQuality) {
        // Both halves are needed for the card and nothing is cached to fall
        // back on — this is the genuine "no data" case.
        throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้');
      }

      setWeather(nextWeather);
      setAirQuality(nextAirQuality);
      setLastUpdated(new Date());
      dataRef.current = { weather: nextWeather, airQuality: nextAirQuality };

      if (!weatherRes.ok || !aqiRes.ok) {
        console.warn('Weather refresh returned partial data:', {
          forecast: weatherRes.status,
          airQuality: aqiRes.status,
        });
        setStaleNotice(
          translateText(
            'ผู้ให้บริการข้อมูลตอบกลับไม่ครบ — แสดงข้อมูลล่าสุดที่มีอยู่',
            'The data provider returned an incomplete response — showing the latest data',
          ),
        );
      } else if (typeof window !== 'undefined') {
        // Only a fully fresh response may claim `savedAt`: marking a cached half
        // as new would stop the widget from retrying it for another TTL.
        const cacheData: CombinedWeatherCache = {
          savedAt: Date.now(),
          cityId: city.id,
          cityName: city.name,
          lat: city.lat,
          lon: city.lon,
          weather: nextWeather,
          airQuality: nextAirQuality,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (err: any) {
      // `fetchWithAuth` reports an aborted caller signal as "Request timeout",
      // so check the widget's own controller as well.
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      console.error('Weather fetch error:', err);
      if (dataRef.current.weather && dataRef.current.airQuality) {
        // Something is already on screen. Raising an alarm over a failed refresh
        // reads as a broken widget, so keep the data and say what happened.
        setStaleNotice(
          translateText(
            'อัปเดตล่าสุดไม่สำเร็จ — กำลังแสดงข้อมูลเดิม',
            'The last update failed — showing the previous data',
          ),
        );
      } else {
        setError(
          translateText(
            'เกิดข้อผิดพลาดในการโหลดข้อมูลสภาพอากาศ',
            'Something went wrong while loading the weather data',
          ),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Auto-Detect Location (GPS) ──────────────────────────────────────────────
  const handleDetectLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError(
        translateText(
          'เบราว์เซอร์ไม่รองรับการระบุพิกัดตำแหน่ง',
          'This browser does not support location detection',
        ),
      );
      return;
    }

    setIsLocating(true);
    setIsCityDropdownOpen(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const resolvedName = await resolveLocationName(latitude, longitude);
          const gpsCity: CityLocation = {
            id: 'gps',
            name: resolvedName,
            lat: latitude,
            lon: longitude,
            isGps: true,
          };
          setSelectedCity(gpsCity);
          localStorage.setItem(LOCATION_KEY, JSON.stringify(gpsCity));
          fetchWeatherData(gpsCity);
        } catch {
          const fallbackCity: CityLocation = {
            id: 'gps',
            name: `${translateText('ตำแหน่งปัจจุบัน', 'Current location')} (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
            lat: latitude,
            lon: longitude,
            isGps: true,
          };
          setSelectedCity(fallbackCity);
          localStorage.setItem(LOCATION_KEY, JSON.stringify(fallbackCity));
          fetchWeatherData(fallbackCity);
        } finally {
          setIsLocating(false);
        }
      },
      (geoErr) => {
        console.warn('Geolocation denied or failed:', geoErr.message);
        setIsLocating(false);
        fetchWeatherData(selectedCity);
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  }, [fetchWeatherData, selectedCity]);

  // ── Initialization with Cache & Auto-GPS ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cachedLoc = safeJsonParse<CityLocation>(localStorage.getItem(LOCATION_KEY));
    const cachedData = safeJsonParse<CombinedWeatherCache>(localStorage.getItem(CACHE_KEY));
    const savedUnit = localStorage.getItem('artWeatherUnit');
    if (savedUnit === 'F' || savedUnit === 'C') setUnit(savedUnit);

    let initialCity = CITY_PRESETS[0];

    if (cachedLoc) {
      initialCity = cachedLoc;
      setSelectedCity(cachedLoc);
    }

    if (cachedData && cachedData.cityId === initialCity.id) {
      const isFresh = Date.now() - cachedData.savedAt < CACHE_TTL_MS;
      setWeather(cachedData.weather);
      setAirQuality(cachedData.airQuality);
      dataRef.current = { weather: cachedData.weather, airQuality: cachedData.airQuality };
      setLastUpdated(new Date(cachedData.savedAt));
      setLoading(false);

      if (!isFresh) {
        fetchWeatherData(initialCity, true);
      }
    } else {
      if (!cachedLoc) {
        handleDetectLocation();
      } else {
        fetchWeatherData(initialCity);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Close dropdown when clicking outside ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handle City Selection ──────────────────────────────────────────────────
  const handleSelectCity = (city: CityLocation) => {
    setSelectedCity(city);
    setIsCityDropdownOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(city));
    }
    fetchWeatherData(city);
  };

  // ── Computed Meta ──────────────────────────────────────────────────────────
  const weatherMeta = useMemo(
    () => getWeatherMeta(weather?.weatherCode ?? 0),
    // `locale` is intentional: getWeatherMeta calls translateText() which reads
    // the active locale, so a language switch must bust this memo even though
    // the dep checker cannot see it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weather?.weatherCode, locale],
  );
  const pm25Meta = useMemo(
    () => getPM25Meta(airQuality?.pm25 ?? 0),
    // Same reason as weatherMeta above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [airQuality?.pm25, locale],
  );

  const WeatherIcon = weatherMeta.icon;
  const ShieldIcon = pm25Meta.icon;

  // With no data at all the full card renders as a tall empty shell, which
  // reads as a broken widget. Collapse it to a compact, actionable state.
  if (error && !weather && !loading) {
    return (
      <section
        className="flex h-full flex-col justify-center rounded-apple-lg bg-[var(--surface)] p-5 border border-[var(--hairline)]"
        aria-labelledby="weather-title"
      >
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-[var(--danger)]" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="weather-title" className="text-[15px] font-bold text-[var(--ink)]">
              {tr('สภาพอากาศ & PM 2.5', 'Weather & PM 2.5')}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchWeatherData(selectedCity, true)}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--accent-hover)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          {refreshing ? tr('กำลังลองใหม่…', 'Trying again…') : tr('ลองอีกครั้ง', 'Try again')}
        </button>
      </section>
    );
  }

  return (
    <section
      className="flex h-full flex-col justify-between rounded-apple-lg bg-[var(--surface)] p-5 border border-[var(--hairline)] transition-all duration-200"
      aria-labelledby="weather-title"
    >
      <div>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Icon badge */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-apple-widget ${weatherMeta.bgClass} ${weatherMeta.colorClass}`}
            >
              <WeatherIcon size={20} aria-hidden="true" />
            </div>

            {/* City Selector & Title */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2
                  id="weather-title"
                  className="text-[16px] font-bold tracking-tight text-[var(--ink)] truncate"
                >
                  {tr('สภาพอากาศ & PM 2.5', 'Weather & PM 2.5')}
                </h2>
              </div>

              {/* Location dropdown trigger */}
              <div className="relative mt-0.5" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                  className="group flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                  aria-expanded={isCityDropdownOpen}
                  aria-haspopup="listbox"
                >
                  {selectedCity.isGps ? (
                    <Navigation size={11} className="text-[var(--accent-text)] fill-[var(--accent)] shrink-0" />
                  ) : (
                    <MapPin
                      size={11}
                      className="text-[var(--ink-tertiary)] group-hover:text-[var(--ink)] shrink-0"
                    />
                  )}
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {cityName(selectedCity)}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-[var(--ink-tertiary)] transition-transform duration-200 ${
                      isCityDropdownOpen ? 'rotate-180 text-[var(--ink)]' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isCityDropdownOpen && (
                  <div className="absolute left-0 top-full z-30 mt-1.5 w-60 rounded-apple-lg border border-[var(--hairline)] bg-[var(--glass-95)] backdrop-blur-2xl p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-150">
                    <div className="border-b border-[var(--hairline)] pb-1 mb-1">
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isLocating}
                        className="flex w-full items-center gap-2 rounded-apple-md px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-50"
                      >
                        <LocateFixed size={13} className={isLocating ? 'animate-spin' : ''} />
                        <span>
                          {isLocating
                            ? tr('กำลังค้นหาพิกัด...', 'Locating…')
                            : tr('ใช้ตำแหน่งเครื่องปัจจุบัน (GPS)', 'Use current device location (GPS)')}
                        </span>
                      </button>
                    </div>

                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                      {tr('จังหวัดยอดนิยม', 'Popular cities')}
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {CITY_PRESETS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCity(c)}
                          className={`flex w-full items-center justify-between rounded-apple-md px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
                            selectedCity.id === c.id
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                              : 'text-[var(--ink)] hover:bg-[var(--surface-chip)]'
                          }`}
                        >
                          <span>{cityName(c)}</span>
                          {selectedCity.id === c.id && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right controls: Refresh & Size Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = unit === 'C' ? 'F' : 'C';
                setUnit(next);
                localStorage.setItem('artWeatherUnit', next);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95] transition-all"
              aria-label={tr('สลับหน่วยอุณหภูมิ', 'Switch temperature unit')}
              title={tr('สลับ °C / °F', 'Switch °C / °F')}
            >
              °{unit}
            </button>
            <button
              type="button"
              onClick={() => fetchWeatherData(selectedCity, true)}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-[0.95] transition-all"
              aria-label={tr('รีเฟรชข้อมูลสภาพอากาศ', 'Refresh weather data')}
              title={tr('รีเฟรชข้อมูล', 'Refresh data')}
            >
              <RefreshCw
                size={15}
                className={`transition-transform duration-300 ${refreshing ? 'animate-spin text-[var(--accent-text)]' : ''}`}
                aria-hidden="true"
              />
            </button>

            {onResize && <WidgetSizeToggle value={width} onChange={onResize} sizes={[1, 2, 3]} />}
          </div>
        </div>

        {/* ── Error Banner ─────────────────────────────────────────────────── */}
        {error && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-apple-md bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12px] font-medium text-[var(--danger)]">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={14} className="shrink-0 text-[var(--danger)]" />
              <span className="truncate">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchWeatherData(selectedCity, true)}
              className="shrink-0 font-bold underline hover:text-[var(--danger)]"
            >
              {tr('ลองใหม่', 'Try again')}
            </button>
          </div>
        )}

        {/* ── Stale-data notice (data is on screen, only the update failed) ── */}
        {!error && staleNotice && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-apple-md bg-[var(--warning-soft)] px-3.5 py-2.5 text-[12px] font-medium text-[var(--warning-ink)]">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={14} className="shrink-0 text-[var(--warning)]" />
              <span className="truncate">{staleNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchWeatherData(selectedCity, true)}
              className="shrink-0 font-bold underline hover:text-[var(--warning-ink)]"
            >
              {tr('ลองใหม่', 'Try again')}
            </button>
          </div>
        )}

        {/* ── Core Metric Cards (Clean & Spacious) ─────────────────────────── */}
        {weather && airQuality && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Weather Info */}
            <div className="flex flex-col justify-between rounded-apple-lg bg-[var(--surface-grouped)] p-4 ring-1 ring-[var(--hairline)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                      {displayTemp(weather.currentTemp)}°
                    </span>
                    <span className="text-xs font-bold text-[var(--ink-tertiary)]">{unit}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold text-[var(--ink)]">
                    {weatherMeta.label}
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink)] shadow-2xs ring-1 ring-[var(--hairline)]">
                    {displayTemp(weather.tempMax)}° / {displayTemp(weather.tempMin)}°
                  </span>
                  <div className="mt-1 text-[11px] font-medium text-[var(--ink-tertiary)]">
                    {tr(
                      'รู้สึกเหมือน {temp}°{unit}',
                      'Feels like {temp}°{unit}',
                      { temp: displayTemp(weather.apparentTemp), unit },
                    )}
                  </div>
                </div>
              </div>

              {/* Sub metrics: Rain chance & Humidity */}
              <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline-soft)] pt-2 text-[11px] font-medium text-[var(--ink-muted)]">
                <div className="flex items-center gap-1">
                  <Droplets size={12} className="text-[var(--accent-text)]" />
                  <span>
                    {tr('ความชื้น {value}%', 'Humidity {value}%', { value: weather.humidity })}
                  </span>
                </div>
                {weather.rainProb > 0 ? (
                  <span className="text-[var(--accent-text)] font-semibold">
                    {tr('โอกาสฝน {value}%', 'Rain chance {value}%', { value: weather.rainProb })}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 text-[var(--ink-tertiary)]">
                    <Wind size={12} />
                    <span>
                      {tr('ลม {value} km/h', 'Wind {value} km/h', { value: weather.windSpeed })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: PM 2.5 & Air Quality */}
            <div className="flex flex-col justify-between rounded-apple-lg bg-[var(--surface-grouped)] p-4 ring-1 ring-[var(--hairline)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                      {airQuality.pm25}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--ink-tertiary)]">µg/m³</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[var(--ink-tertiary)] leading-tight">
                    {tr(
                      'ดัชนีฝุ่น PM 2.5 (US AQI: {aqi})',
                      'PM 2.5 index (US AQI: {aqi})',
                      { aqi: airQuality.usAqi },
                    )}
                  </div>
                </div>

                {/* Level badge */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 whitespace-nowrap shrink-0 ${pm25Meta.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${pm25Meta.dotClass}`} />
                  <span>{pm25Meta.level}</span>
                </div>
              </div>

              {/* Health recommendation */}
              <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--hairline-soft)] pt-2 text-[11px] font-medium text-[var(--ink-muted)]">
                <ShieldIcon size={13} className="shrink-0 text-[var(--ink-tertiary)]" />
                <span className="truncate" title={pm25Meta.healthTip}>
                  {pm25Meta.healthTip}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Hourly Forecast Strip (เวลาล่วงหน้า) ──────────────────────────── */}
        {weather && weather.hourlyForecast && (
          <div className="mt-3.5 rounded-apple-lg bg-[var(--surface-grouped)] p-3.5 ring-1 ring-[var(--hairline)]">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                <Clock size={12} />
                <span>{tr('พยากรณ์รายชั่วโมง (เวลาล่วงหน้า)', 'Hourly forecast (upcoming)')}</span>
              </span>
              <span className="text-[11px] font-medium text-[var(--ink-tertiary)]">
                {tr('อุณหภูมิ / สภาพอากาศ', 'Temperature / conditions')}
              </span>
            </div>

            <div
              className={`grid gap-1 sm:gap-2 ${width >= 3 ? 'grid-cols-6' : width >= 2 ? 'grid-cols-5' : 'grid-cols-4 sm:grid-cols-5'}`}
            >
              {weather.hourlyForecast.slice(0, width >= 3 ? 6 : 5).map((item, index) => {
                const hourMeta = getWeatherMeta(item.weatherCode);
                const HourIcon = hourMeta.icon;
                return (
                  <div
                    key={item.rawTime}
                    className={`flex flex-col items-center justify-center rounded-apple-widget p-2 text-center transition-all duration-150 ${
                      item.isCurrent
                        ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent-ring)] shadow-2xs'
                        : 'bg-[var(--surface)] shadow-2xs ring-1 ring-[var(--hairline)] hover:-translate-y-0.5'
                    } ${width < 2 && index === 4 ? 'hidden sm:flex' : ''}`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        item.isCurrent ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {item.time}
                    </span>
                    <HourIcon size={18} className={`my-1.5 ${hourMeta.colorClass}`} />
                    <span className="text-xs font-extrabold text-[var(--ink)]">
                      {displayTemp(item.temp)}°
                    </span>
                    {item.rainProb > 0 ? (
                      <span className="mt-0.5 text-[11px] font-semibold text-[var(--accent-text)]">
                        💧{item.rainProb}%
                      </span>
                    ) : (
                      <span className="mt-0.5 text-[11px] font-medium text-[var(--ink-tertiary)]">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-3.5 flex items-center justify-between border-t border-[var(--hairline)] pt-2.5 text-[11px] text-[var(--ink-tertiary)]">
        <span>{tr('ข้อมูลสภาพอากาศ & ฝุ่นละอองจาก Open-Meteo', 'Weather & air quality data from Open-Meteo')}</span>
        <span>
          {tr('อัปเดต: {time} น.', 'Updated: {time}', {
            time: lastUpdated.toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          })}
        </span>
      </footer>
    </section>
  );
}
