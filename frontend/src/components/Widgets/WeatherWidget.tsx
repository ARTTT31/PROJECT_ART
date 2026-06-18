'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import type React from 'react'
import { Droplets, Gauge, RefreshCw, Sun, Wind, Search } from 'lucide-react'
import WidgetSizeToggle from './WidgetSizeToggle'
import { showError, showToast } from '@/utils/sweetalert'
import { pushNotifications } from '@/components/Layout/NotificationBell'

interface WeatherData {
  temp: number
  feelsLike: number
  description: string
  icon: string
  scene: string
  cardClass: string
  humidity: number
  windSpeed: number
  uvIndex: number
  pm25: number | null
  aqiLevel: string
  highTemp: number
  lowTemp: number
  sunrise?: string
  sunset?: string
  forecast: Array<{
    day: string
    icon: string
    high: number
    low: number
  }>
}

interface Location {
  name: string
  lat: number
  lon: number
}

interface GeoSuggestion {
  id?: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

const DEFAULT_LOCATION: Location = { name: 'กรุงเทพมหานคร', lat: 13.7563, lon: 100.5018 }
const REFRESH_INTERVAL_MS = 120_000

const WEATHER_LOCATION_KEY = 'artWeatherLocationV1'
const WEATHER_CACHE_KEY = 'artWeatherCacheV1'
const WEATHER_CACHE_TTL_MS = 10 * 60_000 // 10 นาที

const GEOCODE_CACHE_KEY = 'artWeatherReverseGeocodeV1'
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60_000 // 24 ชม.

type WeatherCache = {
  savedAt: number
  location: Location
  weather: WeatherData
  lastUpdate: number
}

type ReverseGeocodeCacheItem = { name: string; savedAt: number }
type ReverseGeocodeCache = Record<string, ReverseGeocodeCacheItem>

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function buildGeoKey(lat: number, lon: number) {
  // ปัดทศนิยมเพื่อลดจำนวน key และกัน jitter จาก GPS
  const la = lat.toFixed(3)
  const lo = lon.toFixed(3)
  return `${la},${lo}`
}

function loadReverseGeocodeCache(): ReverseGeocodeCache {
  const cached = safeJsonParse<ReverseGeocodeCache>(typeof window !== 'undefined' ? localStorage.getItem(GEOCODE_CACHE_KEY) : null)
  return cached && typeof cached === 'object' ? cached : {}
}

function saveReverseGeocodeCache(next: ReverseGeocodeCache) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function loadSavedLocation(): Location | null {
  const cached = safeJsonParse<Location>(typeof window !== 'undefined' ? localStorage.getItem(WEATHER_LOCATION_KEY) : null)
  if (!cached) return null
  if (typeof cached.lat !== 'number' || typeof cached.lon !== 'number') return null
  if (!cached.name) return null
  return cached
}

function saveLocation(loc: Location) {
  try {
    localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(loc))
  } catch {
    // ignore
  }
}

function loadWeatherCache(): WeatherCache | null {
  const cached = safeJsonParse<WeatherCache>(typeof window !== 'undefined' ? localStorage.getItem(WEATHER_CACHE_KEY) : null)
  if (!cached) return null
  if (!cached.savedAt || !cached.weather || !cached.location) return null
  return cached
}

function saveWeatherCache(cache: WeatherCache) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

const getWeatherInfo = (code: number, isDay: boolean) => {
  const weatherMap: Record<number, { description: string; icon: string; scene: string; cardClass: string }> = {
    0: { description: 'ท้องฟ้าแจ่มใส', icon: isDay ? '☀️' : '🌙', scene: isDay ? 'sunny' : 'clear-night', cardClass: isDay ? 'weather-sunny' : 'weather-clear-night' },
    1: { description: 'แจ่มใสเป็นส่วนมาก', icon: isDay ? '🌤️' : '🌙', scene: isDay ? 'sunny' : 'clear-night', cardClass: isDay ? 'weather-sunny' : 'weather-clear-night' },
    2: { description: 'มีเมฆบางส่วน', icon: isDay ? '⛅' : '☁️', scene: isDay ? 'cloudy' : 'cloudy-night', cardClass: isDay ? 'weather-cloudy' : 'weather-cloudy-night' },
    3: { description: 'มีเมฆมาก', icon: '☁️', scene: isDay ? 'cloudy' : 'cloudy-night', cardClass: isDay ? 'weather-cloudy' : 'weather-cloudy-night' },
    45: { description: 'มีหมอก', icon: '🌫️', scene: isDay ? 'cloudy' : 'cloudy-night', cardClass: isDay ? 'weather-cloudy' : 'weather-cloudy-night' },
    51: { description: 'ฝนปรอย', icon: '🌦️', scene: isDay ? 'rainy' : 'rainy-night', cardClass: isDay ? 'weather-rainy' : 'weather-rainy-night' },
    61: { description: 'ฝนตก', icon: '🌧️', scene: isDay ? 'rainy' : 'rainy-night', cardClass: isDay ? 'weather-rainy' : 'weather-rainy-night' },
    80: { description: 'ฝนตกหนัก', icon: '⛈️', scene: isDay ? 'stormy' : 'stormy-night', cardClass: isDay ? 'weather-stormy' : 'weather-stormy-night' },
    95: { description: 'พายุฝนฟ้าคะนอง', icon: '⛈️', scene: isDay ? 'stormy' : 'stormy-night', cardClass: isDay ? 'weather-stormy' : 'weather-stormy-night' },
  }

  return weatherMap[code] || {
    description: 'สภาพอากาศทั่วไป',
    icon: isDay ? '🌤️' : '☁️',
    scene: isDay ? 'sunny' : 'clear-night',
    cardClass: isDay ? 'weather-sunny' : 'weather-clear-night'
  }
}

const getAQILevel = (pm25: number | null) => {
  if (pm25 == null || Number.isNaN(pm25)) return 'ไม่ทราบ'
  if (pm25 <= 15) return 'ดีมาก'
  if (pm25 <= 25) return 'ดี'
  if (pm25 <= 37) return 'ปานกลาง'
  if (pm25 <= 50) return 'เริ่มมีผล'
  return 'ไม่ดี'
}

export default function WeatherWidget({
  width = 1,
  onResize
}: {
  width?: number
  onResize?: (size: number) => void
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location>(() => loadSavedLocation() || DEFAULT_LOCATION)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const searchTimeoutRef = useRef<any>(null)
  const lastErrorToastAtRef = useRef<number>(0)
  const initialLoadDoneRef = useRef(false)
  const weatherAbortRef = useRef<AbortController | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const latestWeatherReqIdRef = useRef(0)
  const geocodeCacheRef = useRef<ReverseGeocodeCache>({})
  const geocodeInFlightRef = useRef<AbortController | null>(null)

  const tempRange = useMemo(() => {
    if (!weather) return 0
    const span = Math.max(weather.highTemp - weather.lowTemp, 1)
    return Math.min(100, Math.max(0, ((weather.temp - weather.lowTemp) / span) * 100))
  }, [weather])

  const reverseGeocodeName = async (lat: number, lon: number): Promise<string | null> => {
    const key = buildGeoKey(lat, lon)
    const now = Date.now()

    const cached = geocodeCacheRef.current[key]
    if (cached && now - cached.savedAt <= GEOCODE_CACHE_TTL_MS) return cached.name

    // ยกเลิกคำขอก่อนหน้าเพื่อกัน spam / race
    if (geocodeInFlightRef.current) geocodeInFlightRef.current.abort()
    const controller = new AbortController()
    geocodeInFlightRef.current = controller

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=th&zoom=14`,
        { signal: controller.signal },
      )
      if (!res.ok) return null

      const data = await res.json()
      const addr = data.address || {}
      const district = addr.suburb || addr.neighbourhood || addr.quarter || ''
      const city = addr.city || addr.town || addr.village || addr.county || ''
      const province = addr.state || ''
      const country = addr.country || ''
      const parts = [district, city || province, country].filter(Boolean)
      const name = parts.length > 0 ? parts.join(', ') : data.display_name || 'ตำแหน่งของคุณ'

      geocodeCacheRef.current[key] = { name, savedAt: now }
      saveReverseGeocodeCache(geocodeCacheRef.current)
      return name
    } catch (e: any) {
      if (e?.name === 'AbortError') return null
      return null
    } finally {
      if (geocodeInFlightRef.current === controller) geocodeInFlightRef.current = null
    }
  }

  const selectLocation = (loc: Location, opts?: { fetch?: boolean }) => {
    setSelectedLocation(loc)
    saveLocation(loc)
    if (opts?.fetch) fetchWeather(loc)
  }

  const fetchWeather = async (location: Location, isRefresh = false) => {
    // ยกเลิกคำขอก่อนหน้า เพื่อกันผลลัพธ์เก่าทับใหม่
    if (weatherAbortRef.current) weatherAbortRef.current.abort()
    const controller = new AbortController()
    weatherAbortRef.current = controller
    const reqId = ++latestWeatherReqIdRef.current

    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams({
        latitude: location.lat.toString(),
        longitude: location.lon.toString(),
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature,uv_index,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
        forecast_days: '5',
        timezone: 'auto',
      })

      const [weatherRes, airQualityRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal }),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=pm2_5`, { signal: controller.signal }).catch(() => ({ ok: false, json: async () => ({}) })),
      ])

      if (!weatherRes.ok) {
        throw new Error(`Weather API returned ${weatherRes.status}`)
      }

      const weatherData = await weatherRes.json()
      const airQualityData = airQualityRes.ok ? await airQualityRes.json() : null
      const weatherInfo = getWeatherInfo(weatherData.current.weather_code, weatherData.current.is_day === 1)
      const pm25Raw = airQualityData?.current?.pm2_5
      const pm25 = typeof pm25Raw === 'number' ? pm25Raw : null

      const sunriseIso = weatherData?.daily?.sunrise?.[0]
      const sunsetIso = weatherData?.daily?.sunset?.[0]
      const sunrise = sunriseIso ? new Date(sunriseIso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : undefined
      const sunset = sunsetIso ? new Date(sunsetIso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : undefined

      const forecast = weatherData.daily.time.slice(0, 5).map((date: string, i: number) => {
        const dayName = i === 0 ? 'วันนี้' : new Date(date).toLocaleDateString('th-TH', { weekday: 'short' })
        const info = getWeatherInfo(weatherData.daily.weather_code[i], true)

        return {
          day: dayName,
          icon: info.icon,
          high: Math.round(weatherData.daily.temperature_2m_max[i]),
          low: Math.round(weatherData.daily.temperature_2m_min[i]),
        }
      })

      const nextWeather: WeatherData = {
        temp: Math.round(weatherData.current.temperature_2m),
        feelsLike: Math.round(weatherData.current.apparent_temperature),
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        scene: weatherInfo.scene,
        cardClass: weatherInfo.cardClass,
        humidity: Math.round(weatherData.current.relative_humidity_2m),
        windSpeed: Math.round(weatherData.current.wind_speed_10m),
        uvIndex: Math.round(weatherData.current.uv_index || 0),
        highTemp: Math.round(weatherData.daily.temperature_2m_max[0]),
        lowTemp: Math.round(weatherData.daily.temperature_2m_min[0]),
        sunrise,
        sunset,
        pm25: pm25 == null ? null : Math.round(pm25),
        aqiLevel: getAQILevel(pm25),
        forecast,
      }
      if (reqId !== latestWeatherReqIdRef.current) return
      setWeather(nextWeather)
      const updatedAt = new Date()
      setLastUpdate(updatedAt)
      setCacheNote(null)
      initialLoadDoneRef.current = true
      saveWeatherCache({
        savedAt: Date.now(),
        location,
        weather: nextWeather,
        lastUpdate: updatedAt.getTime(),
      })

      // Push weather alerts
      const alerts = []
      const uv = Math.round(weatherData.current.uv_index || 0)
      const pm = pm25 == null ? null : Math.round(pm25)
      if (uv >= 8) alerts.push({ id: 'uv-alert', type: 'weather' as const, level: uv >= 11 ? 'danger' as const : 'warning' as const, title: 'UV สูง', body: `ค่า UV Index อยู่ที่ ${uv} — ควรทาครีมกันแดดและหลีกเลี่ยงแสงแดดตรง`, at: new Date() })
      if (pm != null && pm >= 37) alerts.push({ id: 'pm25-alert', type: 'weather' as const, level: pm >= 50 ? 'danger' as const : 'warning' as const, title: 'PM2.5 สูง', body: `ค่าฝุ่น PM2.5 อยู่ที่ ${pm} µg/m³ (${getAQILevel(pm)}) — ควรสวมหน้ากากเมื่อออกนอกอาคาร`, at: new Date() })
      if (alerts.length > 0) pushNotifications(alerts)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('Weather error:', err)
      setErrorMessage('ดึงข้อมูลสภาพอากาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      const now = Date.now()
      if (now - lastErrorToastAtRef.current > 60_000) {
        if (!initialLoadDoneRef.current) showToast('ดึงข้อมูลสภาพอากาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error')
        lastErrorToastAtRef.current = now
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // 1) โหลด cache ขึ้นมาก่อน เพื่อไม่ให้วิดเจ็ตหาย/ว่างเปล่าเวลาต่อเน็ตมีปัญหา
    const cached = loadWeatherCache()
    if (cached && Date.now() - cached.savedAt <= WEATHER_CACHE_TTL_MS) {
      setWeather(cached.weather)
      setLastUpdate(new Date(cached.lastUpdate || cached.savedAt))
      setCacheNote('แสดงข้อมูลจากแคช')
      initialLoadDoneRef.current = true
      setLoading(false)
    }

    // preload reverse geocode cache
    geocodeCacheRef.current = loadReverseGeocodeCache()

    const getGpsAndFetch = async () => {
      if (!navigator.geolocation) {
        fetchWeather(selectedLocation)
        return
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          const gpsName = (await reverseGeocodeName(latitude, longitude)) || 'ตำแหน่งของคุณ'
          const gpsLoc = { name: gpsName, lat: latitude, lon: longitude }
          selectLocation(gpsLoc, { fetch: true })
        },
        () => fetchWeather(selectedLocation)
      )
    }
    getGpsAndFetch()
    return
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      weatherAbortRef.current?.abort()
      searchAbortRef.current?.abort()
      geocodeInFlightRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const interval = setInterval(() => fetchWeather(selectedLocation, true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation])

  useEffect(() => {
    if (!showSuggestions) return
    if (activeSuggestionIndex < 0) return
    const el = document.getElementById(`weather-suggestion-${activeSuggestionIndex}`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeSuggestionIndex, showSuggestions])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearchingLocation(true)
        try {
          // cancel previous search
          if (searchAbortRef.current) searchAbortRef.current.abort()
          const controller = new AbortController()
          searchAbortRef.current = controller

          const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5&language=th`,
            { signal: controller.signal },
          )
          const data = await res.json()
          if (data.results) {
            setSuggestions(data.results as GeoSuggestion[])
            setShowSuggestions(true)
            setActiveSuggestionIndex(0)
          } else {
            setSuggestions([])
            setActiveSuggestionIndex(-1)
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') return
          console.error('Search error:', e)
        } finally {
          setIsSearchingLocation(false)
        }
      }, 400)
    } else {
      if (searchAbortRef.current) searchAbortRef.current.abort()
      setSuggestions([])
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  const handleSelectSuggestion = (loc: GeoSuggestion) => {
    const name = loc.name || ''
    const admin1 = loc.admin1 || ''
    const country = loc.country || ''
    const displayName = [name, admin1, country].filter(Boolean).join(', ')
    selectLocation({ name: displayName || name, lat: loc.latitude, lon: loc.longitude }, { fetch: true })
    setSearchQuery('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  const handleSearchSubmit = () => {
    if (suggestions.length <= 0) return
    const idx = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0
    handleSelectSuggestion(suggestions[Math.min(idx, suggestions.length - 1)])
  }

  if (loading && !initialLoadDoneRef.current) {
    return (
      <div className="premium-card weather-widget-no-hover p-6 min-h-[200px] flex items-center justify-center" role="status" aria-live="polite">
        <div className="space-y-4 w-full animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
            <div className="h-5 w-32 rounded-full bg-slate-200" />
          </div>
          <div className="h-16 w-40 rounded-xl bg-slate-100" />
          <div className="flex gap-3">
            <div className="h-8 flex-1 rounded-lg bg-slate-100" />
            <div className="h-8 flex-1 rounded-lg bg-slate-100" />
            <div className="h-8 flex-1 rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  if (!weather) {
    return (
      <section className="premium-card weather-widget-no-hover p-6 min-h-[220px] flex items-center justify-center" aria-label="สภาพอากาศ">
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">โหลดสภาพอากาศไม่สำเร็จ</p>
          <p className="mt-1 text-xs text-slate-600">{errorMessage || 'กรุณาลองใหม่อีกครั้ง'}</p>
          <button
            type="button"
            onClick={() => fetchWeather(selectedLocation, true)}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 active:scale-95 transition"
          >
            ลองใหม่
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className={`premium-card weather-card weather-widget-no-hover ${weather.cardClass} h-full flex flex-col min-w-0`} style={{ transform: 'none', transition: 'none' }} aria-labelledby="weather-title">
      {/* Animated Weather Scene Backdrop */}
      <div className="weather-scene" id="weatherScene" data-scene={weather.scene} aria-hidden="true">
        <div className="ws-gradient-mesh"></div>
        <div className="ws-bokeh">
          <span className="ws-bokeh-dot"></span>
          <span className="ws-bokeh-dot"></span>
          <span className="ws-bokeh-dot"></span>
          <span className="ws-bokeh-dot"></span>
          <span className="ws-bokeh-dot"></span>
          <span className="ws-bokeh-dot"></span>
        </div>
        <div className="ws-sun"></div>
        <div className="ws-clouds">
          <span className="ws-cloud-blob ws-cloud-blob--1"></span>
          <span className="ws-cloud-blob ws-cloud-blob--2"></span>
          <span className="ws-cloud-blob ws-cloud-blob--3"></span>
          <span className="ws-cloud-blob ws-cloud-blob--4"></span>
          <span className="ws-cloud-blob ws-cloud-blob--5"></span>
          <span className="ws-cloud-blob ws-cloud-blob--6"></span>
        </div>
        <div className="ws-mist"></div>
        <div className="ws-rain"></div>
        <div className="ws-rain ws-rain--front"></div>
        <div className="ws-lightning"></div>
        <div className="ws-shimmer"></div>
      </div>

<div className="relative z-[3] flex flex-col gap-3 p-4 sm:p-5">
      {/* Header row: search + title + controls */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 relative z-50">
            <div className="inline-flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true)
                setActiveSuggestionIndex((idx) => (idx >= 0 ? idx : 0))
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                if (suggestions.length === 0) return
                e.preventDefault()
                setShowSuggestions(true)
                setActiveSuggestionIndex((idx) => Math.min((idx < 0 ? -1 : idx) + 1, suggestions.length - 1))
                return
              }
              if (e.key === 'ArrowUp') {
                if (suggestions.length === 0) return
                e.preventDefault()
                setShowSuggestions(true)
                setActiveSuggestionIndex((idx) => Math.max((idx < 0 ? 0 : idx) - 1, 0))
                return
              }
              if (e.key === 'Escape') {
                setShowSuggestions(false)
                setActiveSuggestionIndex(-1)
                return
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearchSubmit()
              }
            }}
            placeholder="ค้นหาตำแหน่ง"
            role="combobox"
            aria-controls="weather-location-suggestions"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-activedescendant={
              showSuggestions && activeSuggestionIndex >= 0 ? `weather-suggestion-${activeSuggestionIndex}` : undefined
            }
            className="bg-white/15 text-white placeholder:text-white/75 rounded-md px-2 py-1 w-[160px] sm:w-[200px]"
          />
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 text-white flex-shrink-0 hover:bg-white/20 active:scale-95 transition"
            title="ค้นหา"
            aria-label="ค้นหา"
          >
            <Search size={16} />
          </button>
        {/* GPS Location Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      async (position) => {
                        const { latitude, longitude } = position.coords
                        const gpsName = (await reverseGeocodeName(latitude, longitude)) || 'ตำแหน่งของคุณ'
                        selectLocation({
                          name: gpsName,
                          lat: latitude,
                          lon: longitude
                        }, { fetch: true })
                      },
                      (error) => {
                        console.error('GPS error:', error)
                        showError('ไม่สามารถดึงตำแหน่งปัจจุบันของคุณได้', 'กรุณาตรวจสอบสิทธิ์การเข้าถึงตำแหน่ง')
                      }
                    )
                  } else {
                    showToast('เบราว์เซอร์ของคุณไม่รองรับการดึงข้อมูล GPS', 'warning')
                  }
                }}
                 className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-white/10 text-white cursor-pointer"
                 title="ใช้อิงจาก GPS ปัจจุบัน"
                 aria-label="ใช้อิงจาก GPS ปัจจุบัน">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </button>
            </div>
            {/* Auto-suggest Dropdown */}
            {showSuggestions && (
              <div
                id="weather-location-suggestions"
                role="listbox"
                ref={listboxRef}
                className="absolute top-full left-0 mt-1 w-[260px] bg-white/95 backdrop-blur-md rounded-md shadow-lg overflow-hidden z-[100] text-slate-900"
              >
                {isSearchingLocation ? (
                  <div className="px-3 py-2 text-xs text-slate-500 text-center">กำลังค้นหา...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((loc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="option"
                      id={`weather-suggestion-${idx}`}
                      aria-selected={idx === activeSuggestionIndex}
                      className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 focus:bg-slate-50 ${idx === activeSuggestionIndex ? 'bg-slate-50' : ''}`}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                      onClick={() => handleSelectSuggestion(loc)}
                    >
                      <div className="font-medium text-slate-900">{loc.name}</div>
                      {(loc.admin1 || loc.country) && (
                        <div className="text-[10px] text-slate-500">
                          {[loc.admin1, loc.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-slate-500 text-center">ไม่พบผลลัพธ์</div>
                )}
              </div>
            )}
          </div>
          <h3 id="weather-title" className="text-base font-bold text-white tracking-tight">สภาพอากาศ ณ {selectedLocation.name}</h3>
          <p className="text-[11px] text-white/75 flex items-center gap-1.5 flex-wrap">
            <span>อัปเดต {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
            {(loading || refreshing) && <span className="text-white/70 animate-pulse">(กำลังอัปเดต...)</span>}
            {cacheNote && !loading && !refreshing && <span className="text-white/65">({cacheNote})</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onResize && <WidgetSizeToggle value={width} onChange={onResize} />}
          <button
            onClick={() => fetchWeather(selectedLocation, true)}
            className="weather-refresh-btn"
            aria-label="รีเฟรชข้อมูลสภาพอากาศ"
            title="รีเฟรชข้อมูลสภาพอากาศ"
          >
            <RefreshCw size={15} className={loading || refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main content: temp left, metrics right */}
      <div className="grid grid-cols-2 gap-3 items-start">
        {/* Left: icon + temp */}
        <div className="flex items-center gap-3 pl-20">
          <div className="text-7xl leading-none drop-shadow-sm" role="img" aria-label={weather.description}>{weather.icon}</div>
          <div>
            <div className="text-[4rem] font-bold leading-none text-white drop-shadow-sm">{weather.temp}°</div>
            <p className="text-sm font-bold text-white mt-1">{weather.description}</p>
            <p className="text-xs text-white/70">รู้สึกเหมือน {weather.feelsLike}°</p>
            <p className="text-xs text-white/70">สูง {weather.highTemp}° ต่ำ {weather.lowTemp}°</p>
            {(weather.sunrise || weather.sunset) && (
              <p className="text-xs text-white/70">
                {weather.sunrise ? `ขึ้น ${weather.sunrise}` : ''}{weather.sunrise && weather.sunset ? ' • ' : ''}{weather.sunset ? `ตก ${weather.sunset}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Right: metrics + temp bar + PM2.5 */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-1">
            <WeatherMetric icon={<Wind size={15} />} label="ลม" value={`${weather.windSpeed}`} unit="km/h" />
            <WeatherMetric icon={<Droplets size={15} />} label="ชื้น" value={`${weather.humidity}`} unit="%" />
            <WeatherMetric icon={<Sun size={15} />} label="UV" value={weather.uvIndex.toString()} />
          </div>
          {/* Temp range bar */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/70">{weather.lowTemp}°</span>
            <div className="h-1.5 flex-1 rounded-full bg-white/20">
              <div className="relative h-1.5 rounded-full bg-gradient-to-r from-cyan-200 via-amber-200 to-orange-300" style={{ width: `${tempRange}%` }}>
                <span className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-sm" />
              </div>
            </div>
            <span className="text-[10px] text-white/70">{weather.highTemp}°</span>
          </div>
          {weather.pm25 == null ? (
            <div className="mt-1 text-[10px] font-semibold text-white/70">
              PM2.5: ไม่พบข้อมูล
            </div>
          ) : (
            <PM25Bar pm25={weather.pm25} level={weather.aqiLevel} />
          )}
        </div>
      </div>

      {/* Forecast row */}
      <div className="mt-3 w-full max-w-full min-w-0 overflow-x-auto pb-1" aria-label="พยากรณ์อากาศ 5 วัน">
        {/* ใช้ grid เพื่อให้กินพื้นที่แนวนอนให้เต็มก่อน; ถ้าพื้นที่ไม่พอจะ scroll แนวนอน */}
        <div className="grid w-full min-w-[460px] grid-cols-5 gap-2">
          {weather.forecast.map((f) => (
            <div
              key={f.day}
              className="min-w-0 rounded-xl bg-white/10 border border-white/15 px-2.5 py-2 text-center"
              role="group"
              aria-label={`${f.day} สูง ${f.high} ต่ำ ${f.low}`}
            >
              <div className="text-[10px] font-bold text-white/80">{f.day}</div>
              <div className="mt-1 text-xl leading-none" aria-hidden="true">
                {f.icon}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-white/80">
                <span className="text-white">{f.high}°</span>
                <span className="text-white/50">/</span>
                <span className="text-white/70">{f.low}°</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </section>
  )
}

function PM25Bar({ pm25, level }: { pm25: number; level: string }) {
  const pct = Math.min(100, (pm25 / 150) * 100)
  const { color, bg } = pm25 <= 15
    ? { color: 'text-emerald-300', bg: 'from-emerald-400 to-emerald-300' }
    : pm25 <= 25
    ? { color: 'text-lime-300', bg: 'from-lime-400 to-lime-300' }
    : pm25 <= 37
    ? { color: 'text-yellow-300', bg: 'from-yellow-400 to-yellow-300' }
    : pm25 <= 50
    ? { color: 'text-orange-300', bg: 'from-orange-400 to-orange-300' }
    : { color: 'text-red-300', bg: 'from-red-500 to-red-400' }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
          <Gauge size={13} aria-hidden="true" />
          <span>PM2.5</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-sm font-bold ${color} drop-shadow-sm`}>{pm25} <span className="text-[9px] font-semibold text-white/60">µg/m³</span></span>
          <span className={`text-[10px] font-bold ${color}`}>{level}</span>
        </div>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${bg} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
        {[15, 25, 37, 50].map((v) => (
          <span
            key={v}
            className="absolute top-0 h-full w-px bg-white/30"
            style={{ left: `${(v / 150) * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-white/40 font-medium">
        <span>0</span><span>15</span><span>25</span><span>37</span><span>50</span><span>150</span>
      </div>
      <div className="text-[9px] text-white/45 font-medium">เกณฑ์ประมาณการตาม PM2.5 (µg/m³)</div>
    </div>
  )
}

function WeatherMetric({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-xs font-bold text-white/70 mb-0.5">
        {icon}<span>{label}</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-base font-bold text-white">{value}</span>
        {unit && <span className="text-[11px] text-white/60">{unit}</span>}
      </div>
    </div>
  )
}
