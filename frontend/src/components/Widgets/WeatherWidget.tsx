'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import type React from 'react'
import { CalendarDays, Droplets, Gauge, MapPin, RefreshCw, Sun, ThermometerSun, Wind, GripVertical, Search } from 'lucide-react'

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
  pm25: number
  aqiLevel: string
  highTemp: number
  lowTemp: number
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

const locations: Location[] = [
  { name: 'กรุงเทพมหานคร', lat: 13.7563, lon: 100.5018 },
  { name: 'เชียงใหม่', lat: 18.7883, lon: 98.9853 },
  { name: 'ภูเก็ต', lat: 7.8804, lon: 98.3923 },
  { name: 'ขอนแก่น', lat: 16.4322, lon: 102.8236 },
  { name: 'พัทยา', lat: 12.9236, lon: 100.8825 },
]

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

const getAQILevel = (pm25: number) => {
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
  const [selectedLocation, setSelectedLocation] = useState<Location>(locations[0])
  const [showLocationMenu, setShowLocationMenu] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const searchTimeoutRef = useRef<any>(null)

  const tempRange = useMemo(() => {
    if (!weather) return 0
    const span = Math.max(weather.highTemp - weather.lowTemp, 1)
    return Math.min(100, Math.max(0, ((weather.temp - weather.lowTemp) / span) * 100))
  }, [weather])

  const fetchWeather = async (location: Location) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        latitude: location.lat.toString(),
        longitude: location.lon.toString(),
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature,uv_index,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        forecast_days: '5',
        timezone: 'auto',
      })

      const [weatherRes, airQualityRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=pm2_5`),
      ])

      const weatherData = await weatherRes.json()
      const airQualityData = airQualityRes.ok ? await airQualityRes.json() : null
      const weatherInfo = getWeatherInfo(weatherData.current.weather_code, weatherData.current.is_day === 1)
      const pm25 = airQualityData?.current?.pm2_5 || 0

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

      setWeather({
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
        pm25: Math.round(pm25),
        aqiLevel: getAQILevel(pm25),
        forecast,
      })
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Weather error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather(selectedLocation)
    const interval = setInterval(() => fetchWeather(selectedLocation), 120000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearchingLocation(true)
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5&language=th`)
          const data = await res.json()
          if (data.results) {
            setSuggestions(data.results)
            setShowSuggestions(true)
          } else {
            setSuggestions([])
          }
        } catch (e) {
          console.error('Search error:', e)
        } finally {
          setIsSearchingLocation(false)
        }
      }, 400)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (loc: any) => {
    setSelectedLocation({ name: loc.name, lat: loc.latitude, lon: loc.longitude })
    setSearchQuery('')
    setShowSuggestions(false)
  }

  const handleSearchSubmit = () => {
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0])
    }
  }

  if (loading && !weather) {
    return (
      <div className="weather-card weather-sunny p-6 rounded-[24px] min-h-[200px] flex items-center justify-center" role="status" aria-live="polite">
        <div className="space-y-5 w-full">
          <div className="h-6 w-40 rounded-full bg-white/35" />
          <div className="h-24 w-56 rounded-2xl bg-white/30" />
        </div>
      </div>
    )
  }

  if (!weather) return null

  return (
    <section className={`premium-card weather-card weather-widget-no-hover ${weather.cardClass} h-full flex flex-col`} aria-labelledby="weather-title">
      <style>{`
        .weather-widget-no-hover:hover {
          transform: none !important;
          box-shadow: var(--shadow-glass) !important;
          border-color: var(--art-border) !important;
        }
        .weather-widget-no-hover:hover::after, .weather-widget-no-hover:hover::before {
          display: none !important;
        }
      `}</style>
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

<div className="relative z-[3] flex flex-col gap-5 p-5 sm:p-6 flex-1">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <div className="mb-2 relative z-50">
        <div className="inline-flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit() }}
            placeholder="ค้นหาตำแหน่ง"
            className="bg-white/10 text-white placeholder:text-white/50 rounded-md px-2 py-1 focus:outline-none w-[160px] sm:w-[200px]"
          />
          <button
            onClick={handleSearchSubmit}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white flex-shrink-0"
            title="ค้นหา"
          >
            <Search size={16} />
          </button>
        {/* GPS Location Toggle Button */}
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    setLoading(true)
                    navigator.geolocation.getCurrentPosition(
                      async (position) => {
                        const { latitude, longitude } = position.coords
                        // Try reverse geocoding to find city name
                        let gpsName = 'ตำแหน่งของคุณ'
                        try {
                          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=th`)
                          if (res.ok) {
                            const data = await res.json()
                            gpsName = data.city || data.locality || data.principalSubdivision || 'ตำแหน่งของคุณ'
                          }
                        } catch (e) {
                          console.error('Reverse geocode error:', e)
                        }
                        setSelectedLocation({
                          name: gpsName,
                          lat: latitude,
                          lon: longitude
                        })
                      },
                      (error) => {
                        console.error('GPS error:', error)
                        alert('ไม่สามารถดึงตำแหน่งปัจจุบันของคุณได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงตำแหน่ง')
                        setLoading(false)
                      }
                    )
                  } else {
                    alert('เบราว์เซอร์ของคุณไม่รองรับการดึงข้อมูล GPS')
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
              <div className="absolute top-full left-0 mt-1 w-[260px] bg-white/95 backdrop-blur-md rounded-md shadow-lg overflow-hidden z-[100] text-gray-800">
                {isSearchingLocation ? (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">กำลังค้นหา...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((loc, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0"
                      onClick={() => handleSelectSuggestion(loc)}
                    >
                      <div className="font-medium text-gray-900">{loc.name}</div>
                      {(loc.admin1 || loc.country) && (
                        <div className="text-[10px] text-gray-500">
                          {[loc.admin1, loc.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">ไม่พบผลลัพธ์</div>
                )}
              </div>
            )}
          </div>
          <h3 id="weather-title" className="text-lg font-bold text-white tracking-tight">สภาพอากาศ ณ {selectedLocation.name}</h3>
            <p className="mt-1 text-xs text-white/75">อัปเดต {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Drag Handle */}
            <div className="widget-drag-handle flex items-center justify-center w-8 h-8 rounded-full bg-white/20 border border-white/20 text-white/90 hover:text-white hover:bg-white/30 cursor-grab active:cursor-grabbing transition-all select-none" title="ลากเพื่อเปลี่ยนตำแหน่งการจัดวาง">
              <GripVertical size={14} />
            </div>

            {onResize && (
              <div className="flex items-center h-8 rounded-full bg-white/20 border border-white/20 p-0.5 gap-0.5">
                {[2, 3].map((size) => (
                  <button
                    key={size}
                    onClick={() => onResize(size)}
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-extrabold transition-all duration-200 min-w-0 min-h-0 ${
                      width === size
                        ? 'bg-white text-sky-600 shadow-sm'
                        : 'text-white/80'
                    }`}
                    title={`${size === 2 ? 'กลาง (2/3)' : 'ใหญ่ (เต็ม)'}`}
                    aria-label={`ปรับขนาดเป็น ${size === 2 ? 'กลาง' : 'ใหญ่'}`}
                  >
                    {size === 2 ? 'M' : 'L'}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => fetchWeather(selectedLocation)}
              className="weather-refresh-btn"
              aria-label="รีเฟรชข้อมูลสภาพอากาศ"
              title="รีเฟรชข้อมูลสภาพอากาศ"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-1 lg:grid-cols-2 flex-1 items-center">
          <div className="flex items-end justify-between gap-4 p-2">
            <div>
              <div className="text-5xl sm:text-6xl md:text-7xl leading-none drop-shadow-sm" role="img" aria-label={weather.description}>{weather.icon}</div>
              <p className="mt-3 text-sm sm:text-base font-bold text-white">{weather.description}</p>
              <p className="text-xs sm:text-sm text-white/75">รู้สึกเหมือน {weather.feelsLike}°</p>
            </div>
            <div className="text-right">
              <div className="text-[3.5rem] sm:text-[4.5rem] md:text-[5rem] font-bold leading-none tracking-normal text-white drop-shadow-sm">{weather.temp}°</div>
              <p className="mt-1 text-[10px] sm:text-xs font-semibold text-white/75">สูง {weather.highTemp}°  ต่ำ {weather.lowTemp}°</p>
            </div>
          </div>

          <div className="p-2 flex flex-col justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs sm:text-sm text-white/80">
                <span>ช่วงอุณหภูมิ</span>
                <ThermometerSun size={15} aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-white/80">{weather.lowTemp}°</span>
                <div className="h-1.5 flex-1 rounded-full bg-white/20">
                  <div className="relative h-1.5 rounded-full bg-gradient-to-r from-cyan-200 via-amber-200 to-orange-300" style={{ width: `${tempRange}%` }}>
                    <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-white/80">{weather.highTemp}°</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <WeatherMetric icon={<Wind size={15} />} label="ลม" value={`${weather.windSpeed} km/h`} />
              <WeatherMetric icon={<Droplets size={15} />} label="ความชื้น" value={`${weather.humidity}%`} />
              <WeatherMetric icon={<Sun size={15} />} label="UV" value={weather.uvIndex.toString()} />
              <WeatherMetric icon={<Gauge size={15} />} label="PM2.5" value={`${weather.pm25}`} helper={weather.aqiLevel} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function WeatherMetric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper?: string }) {
  return (
    <div className="flex flex-col p-1">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-white/80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-bold text-white drop-shadow-sm">{value}</p>
        {helper && <p className="text-[10px] text-white/75 font-semibold">{helper}</p>}
      </div>
    </div>
  )
}

