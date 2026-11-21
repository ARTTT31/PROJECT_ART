import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  ShieldAlert,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { translateText } from '@/lib/i18n/translate';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CityLocation {
  id: string;
  name: string;
  /** English display name for the bundled city presets. */
  nameEn?: string;
  lat: number;
  lon: number;
  isGps?: boolean;
}

export const CITY_PRESETS: CityLocation[] = [
  { id: 'bkk', name: 'กรุงเทพมหานคร', nameEn: 'Bangkok', lat: 13.7563, lon: 100.5018 },
  { id: 'cnx', name: 'เชียงใหม่', nameEn: 'Chiang Mai', lat: 18.7883, lon: 98.9853 },
  {
    id: 'pty',
    name: 'ชลบุรี / พัทยา',
    nameEn: 'Chonburi / Pattaya',
    lat: 12.9236,
    lon: 100.8825,
  },
  { id: 'ryg', name: 'ระยอง', nameEn: 'Rayong', lat: 12.6815, lon: 101.2816 },
  { id: 'hkt', name: 'ภูเก็ต', nameEn: 'Phuket', lat: 7.8804, lon: 98.3923 },
  { id: 'kkn', name: 'ขอนแก่น', nameEn: 'Khon Kaen', lat: 16.4419, lon: 102.8359 },
  { id: 'nbr', name: 'นนทบุรี', nameEn: 'Nonthaburi', lat: 13.8621, lon: 100.5144 },
  { id: 'spk', name: 'สมุทรปราการ', nameEn: 'Samut Prakan', lat: 13.5991, lon: 100.5968 },
];

/** Display name for a preset or detected city, following the active language. */
export function cityName(city: Pick<CityLocation, 'name' | 'nameEn'>): string {
  return translateText(city.name, city.nameEn ?? city.name);
}

export interface HourlyForecastItem {
  time: string;
  rawTime: string;
  weatherCode: number;
  temp: number;
  rainProb: number;
  isCurrent?: boolean;
}

export interface WeatherData {
  currentTemp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  rainProb: number;
  hourlyForecast: HourlyForecastItem[];
}

export interface AirQualityData {
  pm25: number;
  pm10: number;
  usAqi: number;
}

export interface CombinedWeatherCache {
  savedAt: number;
  cityId: string;
  cityName: string;
  lat: number;
  lon: number;
  weather: WeatherData;
  airQuality: AirQualityData;
}

// ── Cache helpers ────────────────────────────────────────────────────────────

export const CACHE_KEY = 'artWeatherCacheV7';
export const LOCATION_KEY = 'artWeatherLocationV7';
export const CACHE_TTL_MS = 20 * 60_000; // 20 minutes

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── Weather Code Interpreter (WMO standard) ───────────────────────────────────

export function getWeatherMeta(code: number) {
  switch (code) {
    case 0:
      return {
        label: translateText('ท้องฟ้าแจ่มใส', 'Clear sky'),
        icon: Sun,
        colorClass: 'text-[var(--warning)]',
        bgClass: 'bg-[var(--warning-soft)]',
      };
    case 1:
    case 2:
      return {
        label: translateText('มีเมฆบางส่วน', 'Partly cloudy'),
        icon: CloudSun,
        colorClass: 'text-[var(--info-ink)]',
        bgClass: 'bg-[var(--info-soft)]',
      };
    case 3:
      return {
        label: translateText('มีเมฆมาก', 'Mostly cloudy'),
        icon: Cloud,
        colorClass: 'text-[var(--ink-secondary)]',
        bgClass: 'bg-[var(--surface-chip)]',
      };
    case 45:
    case 48:
      return {
        label: translateText('หมอกลง', 'Foggy'),
        icon: CloudFog,
        colorClass: 'text-[var(--ink-secondary)]',
        bgClass: 'bg-[var(--surface-chip)]',
      };
    case 51:
    case 53:
    case 55:
      return {
        label: translateText('ฝนปรอยๆ', 'Light drizzle'),
        icon: CloudDrizzle,
        colorClass: 'text-[var(--info-ink)]',
        bgClass: 'bg-[var(--info-soft)]',
      };
    case 61:
    case 63:
    case 65:
      return {
        label: translateText('ฝนตก', 'Rain'),
        icon: CloudRain,
        colorClass: 'text-[var(--info-ink)]',
        bgClass: 'bg-[var(--info-soft)]',
      };
    case 80:
    case 81:
    case 82:
      return {
        label: translateText('ฝนตกหนัก', 'Heavy rain'),
        icon: CloudRain,
        colorClass: 'text-[var(--info-ink)]',
        bgClass: 'bg-[var(--info-soft)]',
      };
    case 95:
    case 96:
    case 99:
      return {
        label: translateText('ฝนฟ้าคะนอง', 'Thunderstorms'),
        icon: CloudLightning,
        colorClass: 'text-[var(--danger-ink)]',
        bgClass: 'bg-[var(--danger-soft)]',
      };
    default:
      return {
        label: translateText('สภาพอากาศทั่วไป', 'General conditions'),
        icon: CloudSun,
        colorClass: 'text-[var(--info-ink)]',
        bgClass: 'bg-[var(--info-soft)]',
      };
  }
}

// ── PM 2.5 Evaluation (Thailand & US AQI Standards) ──────────────────────────

export function getPM25Meta(pm25: number) {
  if (pm25 <= 15) {
    return {
      level: translateText('ดีมาก', 'Very good'),
      healthTip: translateText(
        'อากาศบริสุทธิ์ เหมาะกับกิจกรรมกลางแจ้งทุกชนิด',
        'Clean air — great for any outdoor activity',
      ),
      badgeClass: 'bg-[var(--success-soft)] text-[var(--success-ink)] ring-[var(--success-soft)]',
      dotClass: 'bg-[var(--success)]',
      icon: ShieldCheck,
    };
  }
  if (pm25 <= 25) {
    return {
      level: translateText('ดี', 'Good'),
      healthTip: translateText(
        'คุณภาพอากาศดี ทำกิจกรรมกลางแจ้งได้ตามปกติ',
        'Good air quality — outdoor activity as usual',
      ),
      badgeClass: 'bg-[var(--info-soft)] text-[var(--info-ink)] ring-[var(--info-soft)]',
      dotClass: 'bg-[var(--info-ink)]',
      icon: ShieldCheck,
    };
  }
  if (pm25 <= 37.5) {
    return {
      level: translateText('ปานกลาง', 'Moderate'),
      healthTip: translateText(
        'กลุ่มเสี่ยงควรสังเกตอาการผิดปกติและเลี่ยงกิจกรรมหนัก',
        'Sensitive groups should watch for symptoms and avoid strenuous activity',
      ),
      badgeClass: 'bg-[var(--warning-soft)] text-[var(--warning-ink)] ring-[var(--warning-soft)]',
      dotClass: 'bg-[var(--warning)]',
      icon: ShieldAlert,
    };
  }
  if (pm25 <= 75) {
    return {
      level: translateText('เริ่มมีผลกระทบ', 'Unhealthy'),
      healthTip: translateText(
        'ควรสวมหน้ากากป้องกันฝุ่นเมื่อออกกลางแจ้ง',
        'Wear a mask when outdoors',
      ),
      badgeClass: 'bg-[var(--warning-soft)] text-[var(--warning-ink)] ring-[var(--warning-soft)]',
      dotClass: 'bg-[var(--warning)]',
      icon: ShieldAlert,
    };
  }
  return {
    level: translateText('มีผลกระทบต่อสุขภาพ', 'Very unhealthy'),
    healthTip: translateText(
      'งดกิจกรรมกลางแจ้งทุกชนิด ใช้อุปกรณ์ฟอกอากาศในอาคาร',
      'Avoid all outdoor activity and use an indoor air purifier',
    ),
    badgeClass: 'bg-[var(--danger-soft)] text-[var(--danger-ink)] ring-[var(--danger-soft)]',
    dotClass: 'bg-[var(--danger)]',
    icon: ShieldAlert,
  };
}
