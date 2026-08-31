'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  Navigation,
  Clock,
} from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'

// ── Types ────────────────────────────────────────────────────────────────────

interface CityLocation {
  id: string
  name: string
  lat: number
  lon: number
  isGps?: boolean
}

const CITY_PRESETS: CityLocation[] = [
  { id: 'bkk', name: 'กรุงเทพมหานคร', lat: 13.7563, lon: 100.5018 },
  { id: 'cnx', name: 'เชียงใหม่', lat: 18.7883, lon: 98.9853 },
  { id: 'pty', name: 'ชลบุรี / พัทยา', lat: 12.9236, lon: 100.8825 },
  { id: 'ryg', name: 'ระยอง', lat: 12.6815, lon: 101.2816 },
  { id: 'hkt', name: 'ภูเก็ต', lat: 7.8804, lon: 98.3923 },
  { id: 'kkn', name: 'ขอนแก่น', lat: 16.4419, lon: 102.8359 },
  { id: 'nbr', name: 'นนทบุรี', lat: 13.8621, lon: 100.5144 },
  { id: 'spk', name: 'สมุทรปราการ', lat: 13.5991, lon: 100.5968 },
]

interface HourlyForecastItem {
  time: string
  rawTime: string
  weatherCode: number
  temp: number
  rainProb: number
  isCurrent?: boolean
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
  hourlyForecast: HourlyForecastItem[]
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
  lat: number
  lon: number
  weather: WeatherData
  airQuality: AirQualityData
}

// ── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_KEY = 'artWeatherCacheV7'
const LOCATION_KEY = 'artWeatherLocationV7'
const CACHE_TTL_MS = 20 * 60_000 // 20 minutes

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// ── Reverse Geocoding Helper ─────────────────────────────────────────────────

async function resolveLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=th`,
    )
    if (res.ok) {
      const data = await res.json()
      const locality = data.locality || ''
      const city = data.city || data.principalSubdivision || ''
      if (locality && city) return `${locality}, ${city}`
      if (city) return city
      if (data.countryName) return data.countryName
    }
  } catch {}
  return `พิกัด ${lat.toFixed(2)}, ${lon.toFixed(2)}`
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
      return { label: 'ฝนตกหนัก', icon: CloudRain, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50' }
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
      badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200/80',
      dotClass: 'bg-sky-500',
      icon: ShieldCheck,
    }
  }
  if (pm25 <= 37.5) {
    return {
      level: 'ปานกลาง',
      healthTip: 'กลุ่มเสี่ยงควรสังเกตอาการผิดปกติและเลี่ยงกิจกรรมหนัก',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200/80',
      dotClass: 'bg-amber-500',
      icon: ShieldAlert,
    }
  }
  if (pm25 <= 75) {
    return {
      level: 'เริ่มมีผลกระทบ',
      healthTip: 'ควรสวมหน้ากากป้องกันฝุ่นเมื่อออกกลางแจ้ง',
      badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200/80',
      dotClass: 'bg-orange-500',
      icon: ShieldAlert,
    }
  }
  return {
    level: 'มีผลกระทบต่อสุขภาพ',
    healthTip: 'งดกิจกรรมกลางแจ้งทุกชนิด ใช้อุปกรณ์ฟอกอากาศในอาคาร',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200/80',
    dotClass: 'bg-rose-500',
    icon: ShieldAlert,
  }
}

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
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=2`
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok`

        const [weatherRes, aqiRes] = await Promise.all([
          fetch(weatherUrl, { signal: controller.signal }),
          fetch(aqiUrl, { signal: controller.signal }),
        ])

        if (!weatherRes.ok || !aqiRes.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้')
        }

        const [weatherJson, aqiJson] = await Promise.all([weatherRes.json(), aqiRes.json()])

        const dailyMax: number[] = weatherJson.daily?.temperature_2m_max || []
        const dailyMin: number[] = weatherJson.daily?.temperature_2m_min || []
        const dailyRain: number[] = weatherJson.daily?.precipitation_probability_max || []

        // Hourly forecast extraction
        const hourlyTimes: string[] = weatherJson.hourly?.time || []
        const hourlyTemps: number[] = weatherJson.hourly?.temperature_2m || []
        const hourlyCodes: number[] = weatherJson.hourly?.weather_code || []
        const hourlyRains: number[] = weatherJson.hourly?.precipitation_probability || []

        const now = new Date()
        const currentHour = now.getHours()
        const todayIsoDate = now.toISOString().slice(0, 10)

        // Find matching current hour index
        let startIndex = hourlyTimes.findIndex((tStr) => {
          const d = new Date(tStr)
          return d.getHours() === currentHour && tStr.startsWith(todayIsoDate)
        })

        if (startIndex === -1) {
          startIndex = 0
        }

        const hourlyList: HourlyForecastItem[] = []
        const totalHoursToExtract = 8

        for (let i = startIndex; i < Math.min(hourlyTimes.length, startIndex + totalHoursToExtract); i++) {
          const d = new Date(hourlyTimes[i])
          const hour = d.getHours()
          const isNow = i === startIndex
          const formattedHour = `${String(hour).padStart(2, '0')}:00`

          hourlyList.push({
            time: isNow ? 'ตอนนี้' : formattedHour,
            rawTime: hourlyTimes[i],
            weatherCode: hourlyCodes[i] ?? 0,
            temp: Math.round(hourlyTemps[i] ?? 0),
            rainProb: hourlyRains[i] ?? 0,
            isCurrent: isNow,
          })
        }

        const mappedWeather: WeatherData = {
          currentTemp: Math.round(weatherJson.current?.temperature_2m ?? 0),
          apparentTemp: Math.round(weatherJson.current?.apparent_temperature ?? 0),
          humidity: Math.round(weatherJson.current?.relative_humidity_2m ?? 0),
          windSpeed: Math.round(weatherJson.current?.wind_speed_10m ?? 0),
          weatherCode: weatherJson.current?.weather_code ?? 0,
          tempMax: Math.round(dailyMax[0] ?? 0),
          tempMin: Math.round(dailyMin[0] ?? 0),
          rainProb: Math.round(dailyRain[0] ?? 0),
          hourlyForecast: hourlyList,
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
            lat: city.lat,
            lon: city.lon,
            weather: mappedWeather,
            airQuality: mappedAqi,
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('Weather fetch error:', err)
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูลสภาพอากาศ')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  // ── Auto-Detect Location (GPS) ──────────────────────────────────────────────
  const handleDetectLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('เบราว์เซอร์ไม่รองรับการระบุพิกัดตำแหน่ง')
      return
    }

    setIsLocating(true)
    setIsCityDropdownOpen(false)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const resolvedName = await resolveLocationName(latitude, longitude)
          const gpsCity: CityLocation = {
            id: 'gps',
            name: resolvedName,
            lat: latitude,
            lon: longitude,
            isGps: true,
          }
          setSelectedCity(gpsCity)
          localStorage.setItem(LOCATION_KEY, JSON.stringify(gpsCity))
          fetchWeatherData(gpsCity)
        } catch {
          const fallbackCity: CityLocation = {
            id: 'gps',
            name: `ตำแหน่งปัจจุบัน (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
            lat: latitude,
            lon: longitude,
            isGps: true,
          }
          setSelectedCity(fallbackCity)
          localStorage.setItem(LOCATION_KEY, JSON.stringify(fallbackCity))
          fetchWeatherData(fallbackCity)
        } finally {
          setIsLocating(false)
        }
      },
      (geoErr) => {
        console.warn('Geolocation denied or failed:', geoErr.message)
        setIsLocating(false)
        fetchWeatherData(selectedCity)
      },
      { timeout: 10000, enableHighAccuracy: false },
    )
  }, [fetchWeatherData, selectedCity])

  // ── Initialization with Cache & Auto-GPS ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    const cachedLoc = safeJsonParse<CityLocation>(localStorage.getItem(LOCATION_KEY))
    const cachedData = safeJsonParse<CombinedWeatherCache>(localStorage.getItem(CACHE_KEY))

    let initialCity = CITY_PRESETS[0]

    if (cachedLoc) {
      initialCity = cachedLoc
      setSelectedCity(cachedLoc)
    }

    if (cachedData && cachedData.cityId === initialCity.id) {
      const isFresh = Date.now() - cachedData.savedAt < CACHE_TTL_MS
      setWeather(cachedData.weather)
      setAirQuality(cachedData.airQuality)
      setLastUpdated(new Date(cachedData.savedAt))
      setLoading(false)

      if (!isFresh) {
        fetchWeatherData(initialCity, true)
      }
    } else {
      if (!cachedLoc) {
        handleDetectLocation()
      } else {
        fetchWeatherData(initialCity)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Close dropdown when clicking outside ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Handle City Selection ──────────────────────────────────────────────────
  const handleSelectCity = (city: CityLocation) => {
    setSelectedCity(city)
    setIsCityDropdownOpen(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(city))
    }
    fetchWeatherData(city)
  }

  // ── Computed Meta ──────────────────────────────────────────────────────────
  const weatherMeta = useMemo(
    () => getWeatherMeta(weather?.weatherCode ?? 0),
    [weather?.weatherCode],
  )
  const pm25Meta = useMemo(() => getPM25Meta(airQuality?.pm25 ?? 0), [airQuality?.pm25])

  const WeatherIcon = weatherMeta.icon
  const ShieldIcon = pm25Meta.icon

  return (
    <section
      className="flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-black/[0.06] shadow-sm transition-all duration-200"
      aria-labelledby="weather-title"
    >
      <div>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${weatherMeta.bgClass} ${weatherMeta.colorClass}`}
            >
              <WeatherIcon size={20} aria-hidden="true" />
            </div>

            {/* City Selector & Title */}
            <div>
              <div className="flex items-center gap-1.5">
                <h2 id="weather-title" className="text-[15px] font-bold tracking-tight text-slate-900">
                  สภาพอากาศ &amp; PM 2.5
                </h2>
              </div>

              {/* Location dropdown trigger */}
              <div className="relative mt-0.5" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                  className="group flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  aria-expanded={isCityDropdownOpen}
                  aria-haspopup="listbox"
                >
                  {selectedCity.isGps ? (
                    <Navigation size={11} className="text-sky-600 fill-sky-500 shrink-0" />
                  ) : (
                    <MapPin size={11} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                  )}
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {selectedCity.name}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-slate-400 transition-transform duration-200 ${
                      isCityDropdownOpen ? 'rotate-180 text-slate-700' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isCityDropdownOpen && (
                  <div className="absolute left-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="border-b border-slate-100 pb-1 mb-1">
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isLocating}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
                      >
                        <LocateFixed size={13} className={isLocating ? 'animate-spin' : ''} />
                        <span>{isLocating ? 'กำลังค้นหาพิกัด...' : 'ใช้ตำแหน่งเครื่องปัจจุบัน (GPS)'}</span>
                      </button>
                    </div>

                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      จังหวัดยอดนิยม
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

        {/* ── Core Metric Cards (Clean & Spacious) ─────────────────────────── */}
        {weather && airQuality && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="mt-0.5 text-xs font-semibold text-slate-700">
                    {weatherMeta.label}
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

              {/* Sub metrics: Rain chance & Humidity */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] font-medium text-slate-600">
                <div className="flex items-center gap-1">
                  <Droplets size={12} className="text-sky-500" />
                  <span>ความชื้น {weather.humidity}%</span>
                </div>
                {weather.rainProb > 0 ? (
                  <span className="text-sky-600 font-semibold">โอกาสฝน {weather.rainProb}%</span>
                ) : (
                  <div className="flex items-center gap-1 text-slate-400">
                    <Wind size={12} />
                    <span>ลม {weather.windSpeed} km/h</span>
                  </div>
                )}
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
          </div>
        )}

        {/* ── Hourly Forecast Strip (เวลาล่วงหน้า) ──────────────────────────── */}
        {weather && weather.hourlyForecast && (
          <div className="mt-3.5 rounded-xl bg-slate-50/60 p-3 ring-1 ring-slate-200/50">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Clock size={12} />
                <span>พยากรณ์รายชั่วโมง (เวลาล่วงหน้า)</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400">อุณหภูมิ / สภาพอากาศ</span>
            </div>

            <div className={`grid gap-2 ${width >= 3 ? 'grid-cols-6' : width >= 2 ? 'grid-cols-5' : 'grid-cols-5'}`}>
              {weather.hourlyForecast.slice(0, width >= 3 ? 6 : 5).map((item) => {
                const hourMeta = getWeatherMeta(item.weatherCode)
                const HourIcon = hourMeta.icon
                return (
                  <div
                    key={item.rawTime}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all duration-150 ${
                      item.isCurrent
                        ? 'bg-sky-50/80 ring-1 ring-sky-200/80 shadow-2xs'
                        : 'bg-white shadow-2xs ring-1 ring-black/[0.04] hover:-translate-y-0.5'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        item.isCurrent ? 'text-sky-700' : 'text-slate-700'
                      }`}
                    >
                      {item.time}
                    </span>
                    <HourIcon size={18} className={`my-1.5 ${hourMeta.colorClass}`} />
                    <span className="text-xs font-extrabold text-slate-800">
                      {item.temp}°
                    </span>
                    {item.rainProb > 0 ? (
                      <span className="mt-0.5 text-[9px] font-semibold text-sky-600">
                        💧{item.rainProb}%
                      </span>
                    ) : (
                      <span className="mt-0.5 text-[9px] font-medium text-slate-300">
                        -
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
      <footer className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span>ข้อมูลสภาพอากาศ &amp; ฝุ่นละอองจาก Open-Meteo</span>
        <span>
          อัปเดต:{' '}
          {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </span>
      </footer>
    </section>
  )
}
