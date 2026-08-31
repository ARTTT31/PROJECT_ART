'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  LocateFixed,
  MapPin,
  RefreshCw,
  Sun,
  Wind,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'

// ── Types ────────────────────────────────────────────────────────────────────

interface CityLocation {
  id: string
  name: string
  lat: number
  lon: number
}

const CITY_PRESETS: CityLocation[] = [
  { id: 'bkk', name: 'กรุงเทพมหานคร', lat: 13.7563, lon: 100.5018 },
  { id: 'cnx', name: 'เชียงใหม่', lat: 18.7883, lon: 98.9853 },
  { id: 'pty', name: 'ชลบุรี / พัทยา', lat: 12.9236, lon: 100.8825 },
  { id: 'ryg', name: 'ระยอง', lat: 12.6815, lon: 101.2816 },
  { id: 'hkt', name: 'ภูเก็ต', lat: 7.8804, lon: 98.3923 },
  { id: 'kkn', name: 'ขอนแก่น', lat: 16.4419, lon: 102.8359 },
]

interface DailyForecastItem {
  date: string
  dayName: string
  weatherCode: number
  tempMax: number
  tempMin: number
  rainProb: number
}

interface WeatherData {
  currentTemp: number
  apparentTemp: number
  humidity: number
  windSpeed: number
  weatherCode: number
  tempMax: number
  tempMin: number
  rainProb: number
  dailyForecast: DailyForecastItem[]
}

interface AirQualityData {
  pm25: number
  pm10: number
  usAqi: number
}

interface CombinedWeatherCache {
  savedAt: number
  cityId: string
  cityName: string
  weather: WeatherData
  airQuality: AirQualityData
}

// ── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_KEY = 'artWeatherCacheV3'
const LOCATION_KEY = 'artWeatherLocationV3'
const CACHE_TTL_MS = 20 * 60_000 // 20 minutes

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// ── Weather Code Interpreter (WMO standard) ───────────────────────────────────

function getWeatherMeta(code: number) {
  switch (code) {
    case 0:
      return { label: 'ท้องฟ้าแจ่มใส', icon: Sun, colorClass: 'text-amber-500', bgClass: 'bg-amber-50' }
    case 1:
    case 2:
      return { label: 'มีเมฆบางส่วน', icon: CloudSun, colorClass: 'text-sky-500', bgClass: 'bg-sky-50' }
    case 3:
      return { label: 'มีเมฆมาก', icon: Cloud, colorClass: 'text-slate-500', bgClass: 'bg-slate-100' }
    case 45:
    case 48:
      return { label: 'หมอกลง', icon: CloudFog, colorClass: 'text-slate-500', bgClass: 'bg-slate-100' }
    case 51:
    case 53:
    case 55:
      return { label: 'ฝนปรอยๆ', icon: CloudDrizzle, colorClass: 'text-blue-500', bgClass: 'bg-blue-50' }
    case 61:
    case 63:
    case 65:
      return { label: 'ฝนตก', icon: CloudRain, colorClass: 'text-blue-600', bgClass: 'bg-blue-50' }
    case 80:
    case 81:
    case 82:
      return { label: 'ฝนตกหนักเป็นระยะ', icon: CloudRain, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50' }
    case 95:
    case 96:
    case 99:
      return { label: 'ฝนฟ้าคะนอง', icon: CloudLightning, colorClass: 'text-purple-600', bgClass: 'bg-purple-50' }
    default:
      return { label: 'สภาพอากาศทั่วไป', icon: CloudSun, colorClass: 'text-sky-500', bgClass: 'bg-sky-50' }
  }
}

// ── PM 2.5 Evaluation (Thailand & US AQI Standards) ──────────────────────────

function getPM25Meta(pm25: number) {
  if (pm25 <= 15) {
    return {
      level: 'ดีมาก',
      healthTip: 'อากาศบริสุทธิ์ เหมาะกับกิจกรรมกลางแจ้งทุกชนิด',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
      dotClass: 'bg-emerald-500',
      icon: ShieldCheck,
    }
  }
  if (pm25 <= 25) {
    return {
      level: 'ดี',
      healthTip: 'คุณภาพอากาศดี ทำกิจกรรมกลางแจ้งได้ตามปกติ',
      badgeClass: 'bg-teal-50 text-teal-700 ring-teal-200/80',
      dotClass: 'bg-teal-500',
      icon: ShieldCheck,
    }
  }
  if (pm25 <= 37.5) {
    return {
      level: 'ปานกลาง',
      healthTip: 'กลุ่มเสี่ยงควรลดเวลาทำกิจกรรมกลางแจ้งที่ใช้แรงมาก',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200/80',
      dotClass: 'bg-amber-500',
      icon: ShieldAlert,
    }
  }
  if (pm25 <= 75) {
    return {
      level: 'เริ่มมีผลกระทบ',
      healthTip: 'ควรสวมหน้ากากป้องกันฝุ่น และลดกิจกรรมกลางแจ้ง',
      badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200/80',
      dotClass: 'bg-orange-500',
      icon: ShieldAlert,
    }
  }
  return {
    level: 'มีผลกระทบต่อสุขภาพ',
    healthTip: 'หลีกเลี่ยงกิจกรรมกลางแจ้ง และสวมหน้ากาก N95 ทันที',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200/80',
    dotClass: 'bg-rose-500',
    icon: ShieldAlert,
  }
}

const THAI_DAY_NAMES = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

// ── Main Component ───────────────────────────────────────────────────────────

export default function WeatherWidget({
  width = 1,
  onResize,
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [selectedCity, setSelectedCity] = useState<CityLocation>(CITY_PRESETS[0])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Load saved city location from localStorage on mount ───────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = safeJsonParse<CityLocation>(localStorage.getItem(LOCATION_KEY))
      if (saved && saved.name && typeof saved.lat === 'number' && typeof saved.lon === 'number') {
        setSelectedCity(saved)
      }
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Fetch Weather & AQI from Open-Meteo ─────────────────────────────────────
  const fetchWeatherData = useCallback(
    async (city: CityLocation, isRefresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok`
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok`

        const [weatherRes, aqiRes] = await Promise.all([
          fetch(weatherUrl, { signal: controller.signal }),
          fetch(aqiUrl, { signal: controller.signal }),
        ])

        if (!weatherRes.ok || !aqiRes.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้')
        }

        const [weatherJson, aqiJson] = await Promise.all([weatherRes.json(), aqiRes.json()])

        const dailyTimes: string[] = weatherJson.daily?.time || []
        const dailyCodes: number[] = weatherJson.daily?.weather_code || []
        const dailyMax: number[] = weatherJson.daily?.temperature_2m_max || []
        const dailyMin: number[] = weatherJson.daily?.temperature_2m_min || []
        const dailyRain: number[] = weatherJson.daily?.precipitation_probability_max || []

        const forecastList: DailyForecastItem[] = dailyTimes.slice(0, 5).map((dStr, idx) => {
          const dObj = new Date(dStr)
          const dayName = idx === 0 ? 'วันนี้' : idx === 1 ? 'พรุ่งนี้' : THAI_DAY_NAMES[dObj.getDay()]
          return {
            date: dStr,
            dayName,
            weatherCode: dailyCodes[idx] ?? 0,
            tempMax: Math.round(dailyMax[idx] ?? 0),
            tempMin: Math.round(dailyMin[idx] ?? 0),
            rainProb: dailyRain[idx] ?? 0,
          }
        })

        const mappedWeather: WeatherData = {
          currentTemp: Math.round(weatherJson.current?.temperature_2m ?? 0),
          apparentTemp: Math.round(weatherJson.current?.apparent_temperature ?? 0),
          humidity: Math.round(weatherJson.current?.relative_humidity_2m ?? 0),
          windSpeed: Math.round(weatherJson.current?.wind_speed_10m ?? 0),
          weatherCode: weatherJson.current?.weather_code ?? 0,
          tempMax: Math.round(dailyMax[0] ?? 0),
          tempMin: Math.round(dailyMin[0] ?? 0),
          rainProb: Math.round(dailyRain[0] ?? 0),
          dailyForecast: forecastList,
        }

        const mappedAqi: AirQualityData = {
          pm25: Math.round((aqiJson.current?.pm2_5 ?? 0) * 10) / 10,
          pm10: Math.round((aqiJson.current?.pm10 ?? 0) * 10) / 10,
          usAqi: Math.round(aqiJson.current?.us_aqi ?? 0),
        }

        setWeather(mappedWeather)
        setAirQuality(mappedAqi)
        setLastUpdated(new Date())

        // Save Cache
        if (typeof window !== 'undefined') {
          const cacheData: CombinedWeatherCache = {
            savedAt: Date.now(),
            cityId: city.id,
            cityName: city.name,
            weather: mappedWeather,
            airQuality: mappedAqi,
          }
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
          } catch {}
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('Weather fetch error:', err)
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  // ── Initial load & cache check ─────────────────────────────────────────────
  useEffect(() => {
    let hasLoadedFromCache = false
    if (typeof window !== 'undefined') {
      const cached = safeJsonParse<CombinedWeatherCache>(localStorage.getItem(CACHE_KEY))
      if (
        cached &&
        cached.cityId === selectedCity.id &&
        Date.now() - cached.savedAt <= CACHE_TTL_MS &&
        cached.weather &&
        cached.airQuality
      ) {
        setWeather(cached.weather)
        setAirQuality(cached.airQuality)
        setLastUpdated(new Date(cached.savedAt))
        setLoading(false)
        hasLoadedFromCache = true
      }
    }

    fetchWeatherData(selectedCity, hasLoadedFromCache)

    // Auto-refresh every 20 minutes
    const interval = setInterval(() => {
      fetchWeatherData(selectedCity, true)
    }, CACHE_TTL_MS)

    return () => {
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [selectedCity, fetchWeatherData])

  // ── Handle City Selection ───────────────────────────────────────────────────
  const handleSelectCity = (city: CityLocation) => {
    setSelectedCity(city)
    setIsCityDropdownOpen(false)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify(city))
      } catch {}
    }
    fetchWeatherData(city)
  }

  // ── Handle Geolocation Detection ───────────────────────────────────────────
  const handleDetectLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsCity: CityLocation = {
          id: 'gps',
          name: 'ตำแหน่งปัจจุบัน (GPS)',
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lon: Math.round(pos.coords.longitude * 10000) / 10000,
        }
        setIsLocating(false)
        handleSelectCity(gpsCity)
      },
      (err) => {
        setIsLocating(false)
        console.warn('Geolocation error:', err)
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึง GPS')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  // ── Loading Skeleton ───────────────────────────────────────────────────────
  if (loading && !weather) {
    return (
      <div
        className="flex min-h-[220px] flex-col justify-between rounded-2xl bg-white p-5 ring-1 ring-black/[0.06] shadow-sm"
        role="status"
        aria-label="กำลังโหลดข้อมูลสภาพอากาศ..."
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-[14px] bg-slate-100 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-28 rounded-md bg-slate-100 animate-pulse" />
              <div className="h-3 w-36 rounded-md bg-slate-100/70 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-24 rounded-full bg-slate-100 animate-pulse" />
        </div>

        <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        </div>

        <div className="flex justify-between items-center">
          <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    )
  }

  const weatherMeta = weather ? getWeatherMeta(weather.weatherCode) : getWeatherMeta(0)
  const pm25Meta = airQuality ? getPM25Meta(airQuality.pm25) : getPM25Meta(10)
  const WeatherIcon = weatherMeta.icon
  const ShieldIcon = pm25Meta.icon

  return (
    <section
      className="flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-black/[0.06] shadow-sm transition-all duration-200"
      aria-labelledby="weather-widget-title"
    >
      {/* ── Widget Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Weather condition icon badge */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${weatherMeta.bgClass}`}
            >
              <WeatherIcon size={20} className={weatherMeta.colorClass} aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="weather-widget-title"
                  className="text-[15px] font-bold tracking-tight text-slate-900 truncate"
                >
                  สภาพอากาศ &amp; PM 2.5
                </h2>
              </div>

              {/* Location selector dropdown */}
              <div className="relative mt-0.5" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                  className="group inline-flex items-center gap-1 text-[12px] font-medium text-slate-600 hover:text-sky-600 focus-visible:outline-none transition-colors"
                  aria-expanded={isCityDropdownOpen}
                  aria-label="เปลี่ยนตำแหน่งพื้นที่"
                >
                  <MapPin size={12} className="text-sky-500 shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">{selectedCity.name}</span>
                  <ChevronDown
                    size={12}
                    className={`text-slate-400 group-hover:text-sky-500 transition-transform ${
                      isCityDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isCityDropdownOpen && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/[0.08] animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      เลือกจังหวัด
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {CITY_PRESETS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCity(c)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
                            selectedCity.id === c.id
                              ? 'bg-sky-50 text-sky-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{c.name}</span>
                          {selectedCity.id === c.id && (
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="mt-1 border-t border-slate-100 pt-1">
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isLocating}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
                      >
                        <LocateFixed size={13} className={isLocating ? 'animate-spin' : ''} />
                        <span>{isLocating ? 'กำลังค้นหาพิกัด...' : 'ใช้ตำแหน่ง GPS ปัจจุบัน'}</span>
                      </button>
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
              onClick={() => fetchWeatherData(selectedCity, true)}
              disabled={refreshing}
              className="art-icon-button text-slate-500 hover:text-slate-800"
              aria-label="รีเฟรชข้อมูลสภาพอากาศ"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw
                size={15}
                className={`transition-transform duration-500 ${refreshing ? 'animate-spin text-sky-600' : ''}`}
                aria-hidden="true"
              />
            </button>

            {onResize && (
              <WidgetSizeToggle
                value={width}
                onChange={onResize}
                sizes={[1, 2, 3]}
              />
            )}
          </div>
        </div>

        {/* ── Error Banner ─────────────────────────────────────────────────── */}
        {error && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={14} className="shrink-0 text-rose-500" />
              <span className="truncate">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchWeatherData(selectedCity, true)}
              className="shrink-0 font-bold underline hover:text-rose-900"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* ── Core Metric Cards ────────────────────────────────────────────── */}
        {weather && airQuality && (
          <div className={`mt-4 grid gap-3 ${width >= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {/* Card 1: Weather Info */}
            <div className="flex flex-col justify-between rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/60">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {weather.currentTemp}°
                    </span>
                    <span className="text-xs font-bold text-slate-500">C</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">{weatherMeta.label}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs ring-1 ring-black/[0.04]">
                    {weather.tempMax}° / {weather.tempMin}°
                  </span>
                  <div className="mt-1 text-[11px] font-medium text-slate-400">
                    รู้สึกเหมือน {weather.apparentTemp}°C
                  </div>
                </div>
              </div>

              {/* Sub metrics: Humidity & Wind */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] font-medium text-slate-600">
                <div className="flex items-center gap-1" title="ความชื้นสัมพัทธ์">
                  <Droplets size={12} className="text-sky-500" />
                  <span>ความชื้น {weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1" title="ความเร็วลม">
                  <Wind size={12} className="text-slate-400" />
                  <span>ลม {weather.windSpeed} km/h</span>
                </div>
              </div>
            </div>

            {/* Card 2: PM 2.5 & Air Quality */}
            <div className="flex flex-col justify-between rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/60">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {airQuality.pm25}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">µg/m³</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    ดัชนีฝุ่น PM 2.5 (US AQI: {airQuality.usAqi})
                  </div>
                </div>

                {/* Level badge */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${pm25Meta.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${pm25Meta.dotClass}`} />
                  <span>{pm25Meta.level}</span>
                </div>
              </div>

              {/* Health recommendation */}
              <div className="mt-3 flex items-center gap-1.5 border-t border-slate-200/60 pt-2 text-[11px] font-medium text-slate-600">
                <ShieldIcon size={13} className="shrink-0 text-slate-400" />
                <span className="truncate" title={pm25Meta.healthTip}>
                  {pm25Meta.healthTip}
                </span>
              </div>
            </div>

            {/* Card 3: Additional Environment Details (Shown on L width >= 3) */}
            {width >= 3 && (
              <div className="flex flex-col justify-between rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  รายละเอียดสภาพแวดล้อม
                </div>
                <div className="my-2 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">โอกาสเกิดฝน:</span>
                    <span className="font-semibold text-sky-600">{weather.rainProb}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ดัชนีฝุ่น PM 10:</span>
                    <span className="font-semibold">{airQuality.pm10} µg/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ดัชนี US AQI:</span>
                    <span className="font-semibold">{airQuality.usAqi}</span>
                  </div>
                </div>
                <div className="border-t border-slate-200/60 pt-2 text-[10px] text-slate-400">
                  พิกัด: {selectedCity.lat.toFixed(2)}, {selectedCity.lon.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Multi-day Forecast Strip (Shown when width >= 2) ────────────────── */}
        {width >= 2 && weather && weather.dailyForecast && (
          <div className="mt-3 rounded-xl bg-slate-50/60 p-3 ring-1 ring-slate-200/50">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              พยากรณ์อากาศล่วงหน้า 5 วัน
            </div>
            <div className={`grid gap-2 ${width >= 3 ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {weather.dailyForecast.map((item) => {
                const dayMeta = getWeatherMeta(item.weatherCode)
                const DayIcon = dayMeta.icon
                return (
                  <div
                    key={item.date}
                    className="flex flex-col items-center justify-center rounded-lg bg-white p-2.5 text-center shadow-2xs ring-1 ring-black/[0.04]"
                  >
                    <span className="text-xs font-bold text-slate-700">{item.dayName}</span>
                    <DayIcon size={18} className={`my-1.5 ${dayMeta.colorClass}`} />
                    <span className="text-[11px] font-semibold text-slate-900">
                      {item.tempMax}° / {item.tempMin}°
                    </span>
                    {item.rainProb > 0 && (
                      <span className="mt-0.5 text-[10px] font-medium text-sky-600">
                        💧 {item.rainProb}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span>ข้อมูลสภาพอากาศ &amp; ฝุ่นละอองจาก Open-Meteo</span>
        <span>
          อัปเดต:{' '}
          {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </span>
      </footer>
    </section>
  )
}
